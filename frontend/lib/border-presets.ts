export type BorderPresetName = 'Classic White' | 'Thin Black' | 'Polaroid' | 'Double Gallery' | 'Square Matte' | 'Portrait Matte' | 'Floating Paper' | 'Frosted Glass' | 'Sunset Gradient' | 'Ocean Gradient' | 'Custom';

export interface BorderSettings {
  enabled: boolean; preset: BorderPresetName; mode: 'custom' | 'double' | 'matte';
  unit: 'px' | 'percent'; top: number; right: number; bottom: number; left: number;
  color: string; sidesLinked: boolean; innerUnit: 'px' | 'percent'; innerSize: number;
  innerColor: string; targetRatio: 'original' | '1:1' | '4:5' | '3:2' | '2:3' | '16:9' | '9:16';
  horizontalAlignment: 'left' | 'center' | 'right'; verticalAlignment: 'top' | 'center' | 'bottom';
  shadowEnabled: boolean; shadowColor: string; shadowOpacity: number; shadowBlur: number; shadowOffsetX: number; shadowOffsetY: number;
  style: 'solid' | 'gradient' | 'frosted'; gradientStart: string; gradientEnd: string; gradientAngle: number;
  frostedBlur: number; frostedTint: string; frostedTintOpacity: number;
}

export const defaultBorderSettings: BorderSettings = {
  enabled: false, preset: 'Custom', mode: 'custom', unit: 'percent', top: 3, right: 3, bottom: 3, left: 3,
  color: '#FFFFFF', sidesLinked: true, innerUnit: 'percent', innerSize: 0, innerColor: '#111111',
  targetRatio: 'original', horizontalAlignment: 'center', verticalAlignment: 'center',
  shadowEnabled: false, shadowColor: '#000000', shadowOpacity: 0.25, shadowBlur: 8, shadowOffsetX: 0, shadowOffsetY: 8,
  style: 'solid', gradientStart: '#FFFFFF', gradientEnd: '#DCE8F5', gradientAngle: 90,
  frostedBlur: 18, frostedTint: '#FFFFFF', frostedTintOpacity: 0.18,
};

export const borderPresets: Record<Exclude<BorderPresetName, 'Custom'>, Partial<BorderSettings>> = {
  'Classic White': { mode: 'custom', unit: 'percent', top: 3, right: 3, bottom: 3, left: 3, color: '#FFFFFF', targetRatio: 'original' },
  'Thin Black': { mode: 'custom', unit: 'percent', top: 1, right: 1, bottom: 1, left: 1, color: '#111111', targetRatio: 'original' },
  'Polaroid': { mode: 'custom', unit: 'percent', top: 3, right: 3, bottom: 12, left: 3, color: '#F8F6EF', targetRatio: 'original', verticalAlignment: 'top' },
  'Double Gallery': { mode: 'double', unit: 'percent', top: 3, right: 3, bottom: 3, left: 3, color: '#FFFFFF', innerUnit: 'percent', innerSize: 0.5, innerColor: '#111111', targetRatio: 'original' },
  'Square Matte': { mode: 'matte', unit: 'percent', top: 3, right: 3, bottom: 3, left: 3, color: '#FFFFFF', targetRatio: '1:1' },
  'Portrait Matte': { mode: 'matte', unit: 'percent', top: 3, right: 3, bottom: 3, left: 3, color: '#FFFFFF', targetRatio: '4:5' },
  'Floating Paper': { mode: 'matte', unit: 'percent', top: 4, right: 4, bottom: 4, left: 4, color: '#FFFFFF', targetRatio: 'original', shadowEnabled: true, shadowColor: '#000000', shadowOpacity: 0.28, shadowBlur: 10, shadowOffsetY: 10 },
  'Frosted Glass': { mode: 'matte', unit: 'percent', top: 5, right: 5, bottom: 5, left: 5, style: 'frosted', frostedBlur: 20, frostedTint: '#EAF4FF', frostedTintOpacity: 0.2, targetRatio: 'original' },
  'Sunset Gradient': { mode: 'custom', unit: 'percent', top: 4, right: 4, bottom: 4, left: 4, style: 'gradient', gradientStart: '#FF6B6B', gradientEnd: '#FFE66D', gradientAngle: 45, targetRatio: 'original' },
  'Ocean Gradient': { mode: 'matte', unit: 'percent', top: 4, right: 4, bottom: 4, left: 4, style: 'gradient', gradientStart: '#123C69', gradientEnd: '#66D9EF', gradientAngle: 135, targetRatio: '1:1' },
};
