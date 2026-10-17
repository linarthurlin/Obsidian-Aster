import type { Material } from './settings';
export interface NativeWindow {
  setBackgroundMaterial?: (material: string) => void;
  isDestroyed?: () => boolean;
}
export interface NativeResult { active: boolean; message: string; }
export class NativeMaterialController {
  private owned = new Set<NativeWindow>();
  apply(win: NativeWindow | null, material: Material, windows: boolean): NativeResult {
    if (material === 'none') {
      if (win && this.owned.has(win)) this.reset(win);
      return { active: false, message: 'Portable CSS surfaces. Native material is off.' };
    }
    if (!windows) return { active: false, message: 'Native materials require Windows 11 22H2 or newer.' };
    if (!win?.setBackgroundMaterial || win.isDestroyed?.())
      return { active: false, message: 'Native window API unavailable. Portable fallback remains active.' };
    try {
      win.setBackgroundMaterial(material);
      this.owned.add(win);
      return { active: true, message: `${material} requested. Windows may use a solid fallback.` };
    } catch {
      if (this.owned.has(win)) this.reset(win);
      return { active: false, message: 'Native material failed. Portable fallback remains active.' };
    }
  }
  private reset(win: NativeWindow) {
    try { if (!win.isDestroyed?.()) win.setBackgroundMaterial?.('auto'); } catch { /* window may be closing */ }
    this.owned.delete(win);
  }
  dispose() { for (const win of [...this.owned]) this.reset(win); }
}
