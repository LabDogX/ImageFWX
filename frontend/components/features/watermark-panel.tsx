'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { SavedTemplate, templatesApi } from '@/lib/api';
import { useLocale } from '@/components/providers/locale-provider';

export type WatermarkPosition = 'northwest' | 'north' | 'northeast' | 'west' | 'center' | 'east' | 'southwest' | 'south' | 'southeast';

export interface TextWatermarkLayer {
  enabled: boolean; text: string; position: WatermarkPosition; font_size: number; opacity: number;
  color: string; shadow_color: string; font: string; offset_x: number; offset_y: number;
}

export interface LogoWatermarkLayer {
  enabled: boolean; image_id: number | null; position: WatermarkPosition; scale: number; opacity: number; offset_x: number; offset_y: number;
}

export interface ExifWatermarkLayer extends Omit<TextWatermarkLayer, 'text'> {
  fields: Array<'camera' | 'lens' | 'captured_at' | 'iso' | 'aperture' | 'shutter_speed' | 'focal_length'>;
  separator: string;
}

export interface WatermarkStack {
  logo: LogoWatermarkLayer;
  primary_text: TextWatermarkLayer;
  secondary_text: TextWatermarkLayer;
  exif: ExifWatermarkLayer;
}

const textLayer = (position: WatermarkPosition): TextWatermarkLayer => ({
  enabled: false, text: '', position, font_size: 24, opacity: 0.7,
  color: '#FFFFFF', shadow_color: '#000000', font: 'noto-sans-sc', offset_x: 0, offset_y: 0,
});

export const defaultWatermarkStack: WatermarkStack = {
  logo: { enabled: false, image_id: null, position: 'northwest', scale: 12, opacity: 1, offset_x: 0, offset_y: 0 },
  primary_text: textLayer('southwest'),
  secondary_text: { ...textLayer('southwest'), font_size: 18, offset_y: 42 },
  // EXIF is not a text layer: keeping this object explicit prevents a legacy
  // ``text`` property from reaching the strict backend EXIF schema.
  exif: {
    enabled: false, position: 'southeast', font_size: 16, opacity: 0.7,
    color: '#FFFFFF', shadow_color: '#000000', font: 'noto-sans-sc', offset_x: 0, offset_y: 0,
    fields: ['camera', 'lens', 'aperture', 'shutter_speed', 'iso', 'focal_length'], separator: ' · ',
  },
};

const positions: WatermarkPosition[] = ['northwest', 'north', 'northeast', 'west', 'center', 'east', 'southwest', 'south', 'southeast'];
const fonts = [
  ['noto-sans-sc', 'Noto Sans CJK SC / 简体黑体'], ['noto-sans-sc-bold', 'Noto Sans CJK SC Bold / 简体粗黑'],
  ['noto-serif-sc', 'Noto Serif CJK SC / 简体宋体'], ['noto-serif-sc-bold', 'Noto Serif CJK SC Bold / 简体粗宋'],
  ['source-han-sans', 'Source Han Sans / 思源黑体'], ['source-han-serif', 'Source Han Serif / 思源宋体'],
  ['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono'], ['inter', 'Inter'], ['inter-bold', 'Inter Bold'],
  ['open-sans', 'Open Sans'], ['open-sans-bold', 'Open Sans Bold'],
] as const;
const exifFields: Array<ExifWatermarkLayer['fields'][number]> = ['camera', 'lens', 'captured_at', 'aperture', 'shutter_speed', 'iso', 'focal_length'];

interface LibraryImage { id: number; originalFilename: string; mimeType: string }

function PositionSelect({ value, onChange }: { value: WatermarkPosition; onChange: (value: WatermarkPosition) => void }) {
  const { t } = useLocale();
  return <label className="text-xs">{t('Position')}<select className="mt-1 w-full rounded border bg-background p-2" value={value} onChange={event => onChange(event.target.value as WatermarkPosition)}>{positions.map(position => <option key={position} value={position}>{t(position)}</option>)}</select></label>;
}

function OpacityControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { t } = useLocale();
  const percentage = Math.round(value * 100);
  const update = (next: number) => onChange(Math.max(5, Math.min(100, next)) / 100);

  return <label className="col-span-2 text-xs">
    <span className="flex items-center justify-between"><span>{t('Opacity')}</span><span>{percentage}%</span></span>
    <div className="mt-1 flex items-center gap-2">
      <Slider className="flex-1" value={[percentage]} min={5} max={100} step={1} onValueChange={([next]) => update(next)} />
      <Input className="w-20" type="number" min="5" max="100" step="1" value={percentage} onChange={event => update(Number(event.target.value) || 5)} aria-label={t('Opacity')} />
      <span className="text-muted-foreground">%</span>
    </div>
  </label>;
}

function TextLayerCard({ title, value, onChange }: { title: string; value: TextWatermarkLayer; onChange: (changes: Partial<TextWatermarkLayer>) => void }) {
  const { t } = useLocale();
  return <div className="space-y-2 rounded border p-3">
    <label className="flex items-center justify-between text-sm font-medium">{t(title)}<input type="checkbox" checked={value.enabled} onChange={event => onChange({ enabled: event.target.checked })} /></label>
    {value.enabled && <>
      <Input value={value.text} maxLength={1000} onChange={event => onChange({ text: event.target.value })} placeholder={t('Enter watermark...')} />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">{t('Font')}<select className="mt-1 w-full rounded border bg-background p-2" value={value.font} onChange={event => onChange({ font: event.target.value })}>{fonts.map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}</select></label>
        <label className="text-xs">{t('Size')}<Input className="mt-1" type="number" min="8" max="128" value={value.font_size} onChange={event => onChange({ font_size: Number(event.target.value) || 8 })} /></label>
        <PositionSelect value={value.position} onChange={position => onChange({ position })} />
        <OpacityControl value={value.opacity} onChange={opacity => onChange({ opacity })} />
        <label className="text-xs">{t('Text color')}<input className="mt-1 h-9 w-full" type="color" value={value.color} onChange={event => onChange({ color: event.target.value.toUpperCase() })} /></label>
        <label className="text-xs">{t('Shadow color')}<input className="mt-1 h-9 w-full" type="color" value={value.shadow_color} onChange={event => onChange({ shadow_color: event.target.value.toUpperCase() })} /></label>
      </div>
    </>}
  </div>;
}

export function WatermarkPanel({ value, onChange, libraryImages, currentImageId }: { value: WatermarkStack; onChange: (value: WatermarkStack) => void; libraryImages: LibraryImage[]; currentImageId: number }) {
  const { t } = useLocale();
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  useEffect(() => { templatesApi.list('watermark').then(setTemplates).catch(() => setTemplates([])); }, []);
  const updateText = (key: 'primary_text' | 'secondary_text', changes: Partial<TextWatermarkLayer>) => onChange({ ...value, [key]: { ...value[key], ...changes } });
  const updateExif = (changes: Partial<ExifWatermarkLayer>) => onChange({ ...value, exif: { ...value.exif, ...changes } });
  const saveTemplate = async () => {
    if (!templateName.trim()) return;
    try { const saved = await templatesApi.create(templateName, 'watermark', value as unknown as Record<string, unknown>); setTemplates(existing => [saved, ...existing]); setTemplateName(''); } catch { /* requires a signed-in account */ }
  };
  const applyTemplate = (template: SavedTemplate) => onChange(template.payload as unknown as WatermarkStack);
  const deleteTemplate = async (templateId: number) => {
    try { await templatesApi.remove(templateId); setTemplates(existing => existing.filter(template => template.id !== templateId)); } catch { /* keep the existing list on failure */ }
  };
  const hasLayer = value.logo.enabled || value.primary_text.enabled || value.secondary_text.enabled || value.exif.enabled;

  return <div className="space-y-4">
    <div className="space-y-2 rounded border p-3"><Label className="text-xs">{t('My watermark templates')}</Label><div className="flex gap-2"><Input value={templateName} maxLength={80} onChange={event => setTemplateName(event.target.value)} placeholder={t('Template name')} /><Button type="button" variant="outline" onClick={saveTemplate} disabled={!templateName.trim()}>{t('Save')}</Button></div>{templates.length > 0 && <div className="flex flex-wrap gap-1">{templates.map(template => <div className="flex" key={template.id}><Button type="button" size="sm" variant="secondary" className="rounded-r-none" onClick={() => applyTemplate(template)}>{template.name}</Button><Button type="button" size="sm" variant="secondary" className="rounded-l-none border-l" aria-label={t('Delete')} onClick={() => deleteTemplate(template.id)}>×</Button></div>)}</div>}</div>
    <div className="space-y-2 rounded border p-3"><label className="flex items-center justify-between text-sm font-medium">{t('Logo')}<input type="checkbox" checked={value.logo.enabled} onChange={event => onChange({ ...value, logo: { ...value.logo, enabled: event.target.checked } })} /></label>{value.logo.enabled && <><select className="w-full rounded border bg-background p-2 text-sm" value={value.logo.image_id ?? ''} onChange={event => onChange({ ...value, logo: { ...value.logo, image_id: event.target.value ? Number(event.target.value) : null } })}><option value="">{t('Select an uploaded image')}</option>{libraryImages.filter(candidate => candidate.id !== currentImageId && candidate.mimeType.startsWith('image/')).map(candidate => <option value={candidate.id} key={candidate.id}>{candidate.originalFilename}</option>)}</select><div className="grid grid-cols-2 gap-2"><PositionSelect value={value.logo.position} onChange={position => onChange({ ...value, logo: { ...value.logo, position } })} /><label className="text-xs">{t('Scale: {count}% of short edge', { count: value.logo.scale })}<Input className="mt-1" type="number" min="1" max="100" value={value.logo.scale} onChange={event => onChange({ ...value, logo: { ...value.logo, scale: Number(event.target.value) || 1 } })} /></label></div></>}</div>
    <TextLayerCard title="Primary text" value={value.primary_text} onChange={changes => updateText('primary_text', changes)} />
    <TextLayerCard title="Secondary text" value={value.secondary_text} onChange={changes => updateText('secondary_text', changes)} />
    <div className="space-y-2 rounded border p-3"><label className="flex items-center justify-between text-sm font-medium">{t('Camera EXIF')}</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value.exif.enabled} onChange={event => updateExif({ enabled: event.target.checked })} /> {t('Show shooting settings')}</label>{value.exif.enabled && <><div className="grid grid-cols-2 gap-2"><PositionSelect value={value.exif.position} onChange={position => updateExif({ position })} /><label className="text-xs">{t('Size')}<Input className="mt-1" type="number" min="8" max="128" value={value.exif.font_size} onChange={event => updateExif({ font_size: Number(event.target.value) || 8 })} /></label><label className="text-xs">{t('Font')}<select className="mt-1 w-full rounded border bg-background p-2" value={value.exif.font} onChange={event => updateExif({ font: event.target.value })}>{fonts.map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}</select></label><label className="text-xs">{t('Separator')}<Input className="mt-1" maxLength={8} value={value.exif.separator} onChange={event => updateExif({ separator: event.target.value || ' · ' })} /></label><OpacityControl value={value.exif.opacity} onChange={opacity => updateExif({ opacity })} /></div><div className="flex flex-wrap gap-x-3 gap-y-1">{exifFields.map(field => <label key={field} className="text-xs"><input className="mr-1" type="checkbox" checked={value.exif.fields.includes(field)} onChange={event => updateExif({ fields: event.target.checked ? [...value.exif.fields, field] : value.exif.fields.filter(current => current !== field) })} />{t(field)}</label>)}</div><p className="text-xs text-muted-foreground">{t('GPS location is never read or displayed.')}</p></>}</div>
    {hasLayer && <p className="rounded bg-muted p-2 text-xs text-muted-foreground">{t('Layers are rendered in order: logo, primary text, secondary text, camera EXIF.')}</p>}
    <Button type="button" variant="outline" className="w-full" onClick={() => onChange(defaultWatermarkStack)}>{t('Reset watermark')}</Button>
  </div>;
}
