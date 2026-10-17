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
}
export const DEFAULT_SETTINGS: GlassSettings = {
  palette: 'warm', surface: 'portable', material: 'none',
  roundedImages: true, reduceMotion: false, contentWidth: 820,
};
export function normalizeSettings(value: unknown): GlassSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const choice = <T extends string>(values: readonly T[], candidate: unknown, fallback: T): T =>
    values.includes(candidate as T) ? candidate as T : fallback;
  return {
    palette: choice(PALETTES, raw.palette, DEFAULT_SETTINGS.palette),
    surface: choice(SURFACES, raw.surface, DEFAULT_SETTINGS.surface),
    material: choice(MATERIALS, raw.material, DEFAULT_SETTINGS.material),
    roundedImages: typeof raw.roundedImages === 'boolean' ? raw.roundedImages : true,
    reduceMotion: typeof raw.reduceMotion === 'boolean' ? raw.reduceMotion : false,
    contentWidth: typeof raw.contentWidth === 'number' && Number.isFinite(raw.contentWidth)
      ? Math.round(Math.min(1100, Math.max(640, raw.contentWidth))) : 820,
  };
}
