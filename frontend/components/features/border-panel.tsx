'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BorderSettings, borderPresets, BorderPresetName, defaultBorderSettings } from '@/lib/border-presets';
import { useLocale } from '@/components/providers/locale-provider';

export function BorderPanel({ value, onChange }: { value: BorderSettings; onChange: (value: BorderSettings) => void }) {
  const { t } = useLocale();
  const set = (changes: Partial<BorderSettings>) => onChange({ ...value, ...changes, preset: changes.preset ?? 'Custom' });
  const setSide = (side: 'top' | 'right' | 'bottom' | 'left', raw: string) => {
    const amount = Number(raw);
    if (!Number.isFinite(amount)) return;
    set(value.sidesLinked ? { top: amount, right: amount, bottom: amount, left: amount } : { [side]: amount });
  };
  const choosePreset = (preset: BorderPresetName) => {
    if (preset === 'Custom') return set({ preset });
    onChange({ ...value, ...borderPresets[preset], enabled: true, preset, sidesLinked: false });
  };
  return <div className="space-y-4 overflow-y-auto pb-4">
    <div className="flex items-center justify-between"><Label>{t('Enable border')}</Label><input type="checkbox" checked={value.enabled} onChange={e => set({ enabled: e.target.checked })} /></div>
    <label className="text-xs font-medium">{t('Preset')}<select className="mt-1 w-full rounded border bg-background p-2" value={value.preset} onChange={e => choosePreset(e.target.value as BorderPresetName)}>{([...Object.keys(borderPresets), 'Custom'] as BorderPresetName[]).map(name => <option key={name}>{t(name)}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-2"><label className="text-xs">{t('Mode')}<select className="mt-1 w-full rounded border bg-background p-2" value={value.mode} onChange={e => set({ mode: e.target.value as BorderSettings['mode'] })}><option value="custom">{t('Custom')}</option><option value="double">{t('Double')}</option><option value="matte">{t('Matte')}</option></select></label><label className="text-xs">{t('Unit')}<select className="mt-1 w-full rounded border bg-background p-2" value={value.unit} onChange={e => set({ unit: e.target.value as BorderSettings['unit'] })}><option value="percent">{t('% short edge')}</option><option value="px">px</option></select></label></div>
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value.sidesLinked} onChange={e => set({ sidesLinked: e.target.checked })} /> {t('Link sides')}</label>
    <div className="grid grid-cols-2 gap-2">{(['top', 'right', 'bottom', 'left'] as const).map(side => <label key={side} className="text-xs capitalize">{t(side.charAt(0).toUpperCase() + side.slice(1))}<Input className="mt-1" type="number" min="0" value={value[side]} onChange={e => setSide(side, e.target.value)} /></label>)}</div>
    <label className="text-xs">{t('Color')}<div className="mt-1 flex gap-2"><input type="color" value={value.color} onChange={e => set({ color: e.target.value.toUpperCase() })} /><Input value={value.color} onChange={e => set({ color: e.target.value })} /></div></label>
    <div className="space-y-2 rounded border p-3"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value.shadowEnabled} onChange={e => set({ shadowEnabled: e.target.checked })} /> {t('Floating shadow')}</label>{value.shadowEnabled && <div className="grid grid-cols-2 gap-2"><label className="text-xs">{t('Shadow color')}<input className="mt-1 h-9 w-full" type="color" value={value.shadowColor} onChange={e => set({ shadowColor: e.target.value.toUpperCase() })} /></label><label className="text-xs">{t('Blur')}<Input className="mt-1" type="number" min="0" max="50" value={value.shadowBlur} onChange={e => set({ shadowBlur: Number(e.target.value) || 0 })} /></label><label className="text-xs">{t('Opacity')}<Input className="mt-1" type="number" min="0" max="1" step="0.05" value={value.shadowOpacity} onChange={e => set({ shadowOpacity: Number(e.target.value) || 0 })} /></label><label className="text-xs">{t('Y offset')}<Input className="mt-1" type="number" value={value.shadowOffsetY} onChange={e => set({ shadowOffsetY: Number(e.target.value) || 0 })} /></label></div>}</div>
    {value.mode === 'double' && <div className="space-y-2 rounded border p-3"><Label className="text-xs">{t('Inner border')}</Label><div className="grid grid-cols-2 gap-2"><Input type="number" min="0" value={value.innerSize} onChange={e => set({ innerSize: Number(e.target.value) })} /><select className="rounded border bg-background p-2 text-xs" value={value.innerUnit} onChange={e => set({ innerUnit: e.target.value as BorderSettings['innerUnit'] })}><option value="percent">{t('% short edge')}</option><option value="px">px</option></select></div><Input value={value.innerColor} onChange={e => set({ innerColor: e.target.value })} /></div>}
    <div className="grid grid-cols-3 gap-2"><label className="col-span-3 text-xs">{t('Canvas ratio')}<select className="mt-1 w-full rounded border bg-background p-2" value={value.targetRatio} onChange={e => set({ targetRatio: e.target.value as BorderSettings['targetRatio'] })}>{['original', '1:1', '4:5', '3:2', '2:3', '16:9', '9:16'].map(r => <option key={r}>{r}</option>)}</select></label><select className="rounded border bg-background p-2 text-xs" value={value.horizontalAlignment} onChange={e => set({ horizontalAlignment: e.target.value as BorderSettings['horizontalAlignment'] })}><option value="left">{t('Left')}</option><option value="center">{t('Center')}</option><option value="right">{t('Right')}</option></select><select className="rounded border bg-background p-2 text-xs" value={value.verticalAlignment} onChange={e => set({ verticalAlignment: e.target.value as BorderSettings['verticalAlignment'] })}><option value="top">{t('Top')}</option><option value="center">{t('Center')}</option><option value="bottom">{t('Bottom')}</option></select></div>
    <Button variant="outline" className="w-full" onClick={() => onChange(defaultBorderSettings)}>{t('Reset border')}</Button>
  </div>;
}
