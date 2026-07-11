'use client';

import { useCallback, useEffect, useState } from 'react';
import { Folder, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { nasApi } from '@/lib/api';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';

type NASFile = { name: string; relative_path: string; size: number; modified_at: string };
type Browse = { path: string; parent: string | null; directories: { name: string; relative_path: string }[]; files: NASFile[] };

export function NASBrowser() {
  const [enabled, setEnabled] = useState(false);
  const [listing, setListing] = useState<Browse | null>(null); const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false); const { addImages } = useStore();
  const load = useCallback(async (path = '') => { setLoading(true); try { const result = await nasApi.browse(path); setListing(result); setSelected([]); } catch (e: any) { toast.error(e.response?.data?.detail || 'Unable to browse NAS'); } finally { setLoading(false); } }, []);
  useEffect(() => { nasApi.status().then(data => setEnabled(Boolean(data.enabled))).catch(() => setEnabled(false)); }, []);
  useEffect(() => { if (enabled && !listing) load(); }, [enabled, listing, load]);
  if (!enabled) return null;
  const importSelected = async () => { if (!selected.length) return; setLoading(true); try { const result = await nasApi.import(selected); addImages(result.images.map((i: any) => ({ id: i.id, originalFilename: i.original_filename, storedFilename: i.stored_filename, thumbnailUrl: i.thumbnail_url, mimeType: i.mime_type, fileSize: i.file_size, width: i.width, height: i.height, format: i.format, createdAt: i.created_at, projectId: null }))); toast.success(`Imported ${result.images.length} photo(s)`); if (result.failed.length) toast.error(`${result.failed.length} file(s) were not imported`); } catch (e: any) { toast.error(e.response?.data?.detail || 'NAS import failed'); } finally { setLoading(false); } };
  if (!enabled) return null;
  return <div className="rounded-xl border p-4 space-y-3"><div><h3 className="font-medium text-sm">NAS photos</h3><p className="text-xs text-muted-foreground">Original files stay read-only; imports are copied into the library.</p></div><div className="space-y-3"><div className="flex gap-2 text-xs"><Button size="sm" variant="ghost" disabled={!listing?.parent || loading} onClick={() => load(listing?.parent || '')}><ChevronLeft className="h-4 w-4" />Up</Button><span className="self-center truncate">/{listing?.path || ''}</span></div>{loading && <Loader2 className="h-5 w-5 animate-spin" />}{listing?.directories.map(dir => <button className="block w-full text-left rounded p-2 hover:bg-muted text-sm" key={dir.relative_path} onClick={() => load(dir.relative_path)}><Folder className="mr-2 inline h-4 w-4" />{dir.name}</button>)}{listing?.files.length ? <><label className="flex gap-2 text-xs"><input type="checkbox" checked={selected.length === listing.files.length} onChange={e => setSelected(e.target.checked ? listing.files.map(f => f.relative_path) : [])} />Select all</label>{listing.files.map(file => <label key={file.relative_path} className="flex gap-2 rounded p-2 hover:bg-muted text-sm"><input type="checkbox" checked={selected.includes(file.relative_path)} onChange={e => setSelected(s => e.target.checked ? [...s, file.relative_path] : s.filter(p => p !== file.relative_path))} /><span className="truncate">{file.name}</span><span className="ml-auto text-xs text-muted-foreground">{Math.round(file.size / 1024 / 1024 * 10) / 10} MB</span></label>)}<Button disabled={!selected.length || loading} onClick={importSelected}>Import selected ({selected.length})</Button></> : listing && !loading && <p className="text-xs text-muted-foreground">No supported images in this folder.</p>}</div></div>;
}
