export const PALETTES = ['warm', 'mineral', 'rose'] as const;
export const SURFACES = ['focus', 'glass', 'portable'] as const;
export const MATERIALS = ['none', 'mica', 'acrylic', 'tabbed'] as const;
export type Material = typeof MATERIALS[number];
export interface GlassSettings {
  palette: typeof PALETTES[number];
  surface: typeof SURFACES[number];
  material: Material;
  roundedImages: boolean;
  reduceMotion: boolean;
  contentWidth: number;
  navigatorLayout: 'auto' | 'single' | 'dual';
  navigatorPreviews: boolean;
  pinnedPaths: string[];
  recentPaths: string[];
  selectionLightStart: string;
  selectionLightEnd: string;
  selectionDarkStart: string;
  selectionDarkEnd: string;
  selectionLightOpacity: number;
  selectionDarkOpacity: number;
  selectionBlur: number;
  selectionGlass: number;
  selectionAngle: number;
}
export const DEFAULT_SETTINGS: GlassSettings = {
  palette: 'warm', surface: 'portable', material: 'none',
  roundedImages: true, reduceMotion: false, contentWidth: 820,
  navigatorLayout: 'auto', navigatorPreviews: false, pinnedPaths: [], recentPaths: [],
  selectionLightStart: '#e9d9ba', selectionLightEnd: '#c8dacb',
  selectionDarkStart: '#514a39', selectionDarkEnd: '#354c41',
  selectionLightOpacity: 100, selectionDarkOpacity: 100, selectionBlur: 0,
  selectionGlass: 0, selectionAngle: 115,
};
export function normalizeSettings(value: unknown): GlassSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const choice = <T extends string>(values: readonly T[], candidate: unknown, fallback: T): T =>
    values.includes(candidate as T) ? candidate as T : fallback;
  const color = (key: keyof GlassSettings) => typeof raw[key] === 'string' && /^#[0-9a-f]{6}$/i.test(raw[key] as string)
    ? (raw[key] as string).toLowerCase() : DEFAULT_SETTINGS[key] as string;
  const number = (key: keyof GlassSettings, min: number, max: number) => typeof raw[key] === 'number' && Number.isFinite(raw[key])
    ? Math.round(Math.min(max, Math.max(min, raw[key] as number))) : DEFAULT_SETTINGS[key] as number;
  return {
    palette: choice(PALETTES, raw.palette, DEFAULT_SETTINGS.palette),
    surface: choice(SURFACES, raw.surface, DEFAULT_SETTINGS.surface),
    material: choice(MATERIALS, raw.material, DEFAULT_SETTINGS.material),
    roundedImages: typeof raw.roundedImages === 'boolean' ? raw.roundedImages : true,
    reduceMotion: typeof raw.reduceMotion === 'boolean' ? raw.reduceMotion : false,
    contentWidth: typeof raw.contentWidth === 'number' && Number.isFinite(raw.contentWidth)
      ? Math.round(Math.min(1100, Math.max(640, raw.contentWidth))) : 820,
    navigatorLayout: choice(['auto', 'single', 'dual'] as const, raw.navigatorLayout, 'auto'),
    navigatorPreviews: raw.navigatorPreviews === true,
    pinnedPaths: sanitizePaths(raw.pinnedPaths, 200),
    recentPaths: sanitizePaths(raw.recentPaths, 40),
    selectionLightStart: color('selectionLightStart'), selectionLightEnd: color('selectionLightEnd'),
    selectionDarkStart: raw.selectionDarkStart === '#a48c5c' && raw.selectionDarkEnd === '#6e9b83' ? DEFAULT_SETTINGS.selectionDarkStart : color('selectionDarkStart'),
    selectionDarkEnd: raw.selectionDarkStart === '#a48c5c' && raw.selectionDarkEnd === '#6e9b83' ? DEFAULT_SETTINGS.selectionDarkEnd : color('selectionDarkEnd'),
    // Legacy fields remain readable, but flat selection never re-enables glass from old data.
    selectionLightOpacity: 100, selectionDarkOpacity: 100,
    selectionBlur: 0, selectionGlass: 0,
    selectionAngle: number('selectionAngle', 0, 360),
  };
}
function sanitizePaths(value: unknown, limit: number): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((path): path is string => typeof path === 'string'
    && path.length > 0 && path.length < 1024 && !path.startsWith('/') && !path.includes('\\')
    && !path.split('/').some(part => part === '..' || part.startsWith('.'))))].slice(0, limit) : [];
}
