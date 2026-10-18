import { normalizeSettings, type GlassSettings } from './settings';
function readableText(start: string, end: string, opacity: number, dark: boolean): string {
  const alpha = opacity / 100, base = dark ? [36, 40, 36] : [250, 249, 246];
  const luminance = (hex: string) => [1, 3, 5].map((index, channel) => {
    const srgb = (parseInt(hex.slice(index, index + 2), 16) * alpha + base[channel] * (1 - alpha)) / 255;
    return srgb <= .04045 ? srgb / 12.92 : ((srgb + .055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const endpoints = [luminance(start), luminance(end)];
  const black = Math.min(...endpoints.map(value => (value + .05) / .05));
  const white = Math.min(...endpoints.map(value => 1.05 / (value + .05)));
  return black >= white ? '#151915' : '#ffffff';
}
export function selectionVariables(settings: GlassSettings): Record<string, string> {
  const s = normalizeSettings(settings), strength = s.selectionGlass / 100;
  return {
    '--pg-selection-light-start': s.selectionLightStart, '--pg-selection-light-end': s.selectionLightEnd,
    '--pg-selection-dark-start': s.selectionDarkStart, '--pg-selection-dark-end': s.selectionDarkEnd,
    '--pg-selection-light-text': readableText(s.selectionLightStart, s.selectionLightEnd, s.selectionLightOpacity, false),
    '--pg-selection-dark-text': readableText(s.selectionDarkStart, s.selectionDarkEnd, s.selectionDarkOpacity, true),
    '--pg-selection-light-opaque-text': readableText(s.selectionLightStart, s.selectionLightEnd, 100, false),
    '--pg-selection-dark-opaque-text': readableText(s.selectionDarkStart, s.selectionDarkEnd, 100, true),
    '--pg-selection-light-opacity': `${s.selectionLightOpacity}%`, '--pg-selection-dark-opacity': `${s.selectionDarkOpacity}%`,
    '--pg-selection-blur': `${s.selectionGlass === 0 ? 0 : s.selectionBlur}px`, '--pg-selection-angle': `${s.selectionAngle}deg`,
    '--pg-selection-highlight': `${Math.round(strength * 70)}%`,
    '--pg-selection-shadow': `${Math.round(strength * 16)}%`,
    '--pg-selection-shadow-size': `${Math.round(strength * 12)}px`,
  };
}
