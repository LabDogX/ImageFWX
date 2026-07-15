'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Folder, Grid2X2, ImageIcon, List, Loader2 } from 'lucide-react';
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
type ViewMode = 'list' | 'grid';

const formatSize = (size: number) => `${Math.round(size / 1024 / 1024 * 10) / 10} MB`;

function NASThumbnail({ file }: { file: NASFile }) {
  const { t } = useLocale();
  const elementRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [source, setSource] = useState<string | null>(null);

  // Request image blobs only once their card approaches the viewport. The
  // endpoint itself remains authenticated, so a token is never placed in a URL.
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '240px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    let objectUrl: string | null = null;
    nasApi.thumbnail(file.relative_path).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => { /* leave the neutral image placeholder visible */ });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.relative_path, visible]);

  return <div ref={elementRef} className="relative aspect-square overflow-hidden rounded bg-muted">
    {source ? <img src={source} alt={file.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-7 w-7" aria-label={t('Loading thumbnail')} /></div>}
  </div>;
}

export function NASBrowser() {
  const [enabled, setEnabled] = useState(false);
  const [listing, setListing] = useState<Browse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const { addImages } = useStore();
  const { t } = useLocale();

  useEffect(() => {
    const saved = window.localStorage.getItem('imagefwx-nas-view-mode');
    if (saved === 'list' || saved === 'grid') setViewMode(saved);
  }, []);
  useEffect(() => { window.localStorage.setItem('imagefwx-nas-view-mode', viewMode); }, [viewMode]);

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

  const toggleSelected = (relativePath: string, checked: boolean) => {
    setSelected((current) => checked ? [...current, relativePath] : current.filter((path) => path !== relativePath));
  };

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
        toast.error(t('{count} file(s) were not imported', { count: result.failed.length }), { description: failureMessage });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('NAS import failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) return null;

  return <div className="space-y-3 rounded-xl border p-4">
    <div>
      <h3 className="text-sm font-medium">{t('NAS photos')}</h3>
      <p className="text-xs text-muted-foreground">{t('Original files stay read-only; imports are copied into the library.')}</p>
    </div>
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <Button size="sm" variant="ghost" disabled={listing === null || listing.parent === null || loading} onClick={() => load(listing?.parent ?? '')}><ChevronLeft className="h-4 w-4" />{t('Up')}</Button>
        <span className="min-w-0 flex-1 truncate">/{listing?.path || ''}</span>
        <div className="flex rounded-md border p-0.5" aria-label={t('View mode')}>
          <Button size="icon" variant={viewMode === 'list' ? 'secondary' : 'ghost'} className="h-7 w-7" onClick={() => setViewMode('list')} aria-label={t('List view')}><List className="h-4 w-4" /></Button>
          <Button size="icon" variant={viewMode === 'grid' ? 'secondary' : 'ghost'} className="h-7 w-7" onClick={() => setViewMode('grid')} aria-label={t('Thumbnail view')}><Grid2X2 className="h-4 w-4" /></Button>
        </div>
      </div>
      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {listing?.directories.map((directory) => <button className="block w-full rounded p-2 text-left text-sm hover:bg-muted" key={directory.relative_path} onClick={() => load(directory.relative_path)}><Folder className="mr-2 inline h-4 w-4" />{directory.name}</button>)}
      {listing?.files.length ? <>
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={selected.length === listing.files.length} onChange={(event) => setSelected(event.target.checked ? listing.files.map((file) => file.relative_path) : [])} />{t('Select all')}</label>
        {viewMode === 'list' ? <div className="space-y-1">{listing.files.map((file) => <label key={file.relative_path} className="flex gap-2 rounded p-2 text-sm hover:bg-muted"><input type="checkbox" checked={selected.includes(file.relative_path)} onChange={(event) => toggleSelected(file.relative_path, event.target.checked)} /><span className="truncate">{file.name}</span><span className="ml-auto text-xs text-muted-foreground">{formatSize(file.size)}</span></label>)}</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{listing.files.map((file) => <label key={file.relative_path} className="group relative rounded border p-1.5 text-xs hover:bg-muted"><NASThumbnail file={file} /><input className="absolute left-3 top-3 h-4 w-4" type="checkbox" checked={selected.includes(file.relative_path)} onChange={(event) => toggleSelected(file.relative_path, event.target.checked)} aria-label={t('Select {name}', { name: file.name })} /><span className="mt-1 block truncate" title={file.name}>{file.name}</span><span className="text-muted-foreground">{formatSize(file.size)}</span></label>)}</div>}
        <Button disabled={!selected.length || loading} onClick={importSelected}>{t('Import selected ({count})', { count: selected.length })}</Button>
      </> : listing && !loading ? <p className="text-xs text-muted-foreground">{t('No supported images in this folder.')}</p> : null}
    </div>
  </div>;
}
