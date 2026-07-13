'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Folder, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { nasApi } from '@/lib/api';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';

type NASFile = { name: string; relative_path: string; size: number; modified_at: string };
type Browse = {
  path: string;
  parent: string | null;
  directories: { name: string; relative_path: string }[];
  files: NASFile[];
};

export function NASBrowser() {
  const [enabled, setEnabled] = useState(false);
  const [listing, setListing] = useState<Browse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { addImages } = useStore();
  const { t } = useLocale();

  const load = useCallback(async (path = '') => {
    setLoading(true);
    try {
      const result = await nasApi.browse(path);
      setListing(result);
      setSelected([]);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('Unable to browse NAS'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    nasApi.status().then((data) => setEnabled(Boolean(data.enabled))).catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (enabled && !listing) load();
  }, [enabled, listing, load]);

  const importSelected = async () => {
    if (!selected.length) return;
    setLoading(true);
    try {
      const result = await nasApi.import(selected);
      addImages(result.images.map((image: any) => ({
        id: image.id,
        originalFilename: image.original_filename,
        storedFilename: image.stored_filename,
        thumbnailUrl: image.thumbnail_url,
        mimeType: image.mime_type,
        fileSize: image.file_size,
        width: image.width,
        height: image.height,
        format: image.format,
        createdAt: image.created_at,
        projectId: null,
      })));
      toast.success(t('Imported {count} photo(s)', { count: result.images.length }));
      if (result.failed.length) {
        const firstFailure = result.failed[0];
        const failureMessage = firstFailure?.error_code === 'copy_failed'
          ? t('Unable to copy the file into application storage')
          : firstFailure?.error_code === 'registration_failed'
            ? t('Unable to add the imported file to the image library')
            : firstFailure?.error;
        toast.error(t('{count} file(s) were not imported', { count: result.failed.length }), {
          description: failureMessage,
        });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('NAS import failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) return null;

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div>
        <h3 className="text-sm font-medium">{t('NAS photos')}</h3>
        <p className="text-xs text-muted-foreground">
          {t('Original files stay read-only; imports are copied into the library.')}
        </p>
      </div>
      <div className="space-y-3">
        <div className="flex gap-2 text-xs">
          <Button size="sm" variant="ghost" disabled={listing === null || listing.parent === null || loading} onClick={() => load(listing?.parent ?? '')}>
            <ChevronLeft className="h-4 w-4" />{t('Up')}
          </Button>
          <span className="self-center truncate">/{listing?.path || ''}</span>
        </div>
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        {listing?.directories.map((directory) => (
          <button className="block w-full rounded p-2 text-left text-sm hover:bg-muted" key={directory.relative_path} onClick={() => load(directory.relative_path)}>
            <Folder className="mr-2 inline h-4 w-4" />{directory.name}
          </button>
        ))}
        {listing?.files.length ? (
          <>
            <label className="flex gap-2 text-xs">
              <input type="checkbox" checked={selected.length === listing.files.length} onChange={(event) => setSelected(event.target.checked ? listing.files.map((file) => file.relative_path) : [])} />
              {t('Select all')}
            </label>
            {listing.files.map((file) => (
              <label key={file.relative_path} className="flex gap-2 rounded p-2 text-sm hover:bg-muted">
                <input type="checkbox" checked={selected.includes(file.relative_path)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, file.relative_path] : current.filter((path) => path !== file.relative_path))} />
                <span className="truncate">{file.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{Math.round(file.size / 1024 / 1024 * 10) / 10} MB</span>
              </label>
            ))}
            <Button disabled={!selected.length || loading} onClick={importSelected}>
              {t('Import selected ({count})', { count: selected.length })}
            </Button>
          </>
        ) : listing && !loading ? <p className="text-xs text-muted-foreground">{t('No supported images in this folder.')}</p> : null}
      </div>
    </div>
  );
}
