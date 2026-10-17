import { Plugin, PluginSettingTab, Setting, Notice, Platform, type App } from 'obsidian';
import { DEFAULT_SETTINGS, normalizeSettings, PALETTES, SURFACES, MATERIALS, type GlassSettings } from './settings';
import { TEMPLATES, createInsertion } from './commands';
import { NativeMaterialController, type NativeWindow } from './native';

declare const require: (name: string) => unknown;
interface SurfaceState {
  body: HTMLElement;
  attributes: Map<string, string | null>;
  width: string;
  widthPriority: string;
}
const ATTRS = ['data-personal-palette', 'data-personal-surface', 'data-personal-images', 'data-personal-motion', 'data-personal-native'];
export default class PersonalGlass extends Plugin {
  settings: GlassSettings = { ...DEFAULT_SETTINGS };
  native = new NativeMaterialController();
  nativeStatus = 'Native material is off.';
  private surfaces = new Map<Document, SurfaceState>();

  async onload() {
    this.settings = normalizeSettings(await this.loadData());
    for (const template of TEMPLATES) this.addCommand({
      id: template.id, name: template.name,
      editorCallback: editor => {
        const from = editor.getCursor('from'), to = editor.getCursor('to');
        const start = editor.posToOffset(from), end = editor.posToOffset(to);
        const source = editor.getValue();
        const result = createInsertion(template, editor.getSelection(), source.slice(0, start), source.slice(end));
        editor.replaceRange(result.text, from, to);
        editor.setSelection(editor.offsetToPos(start + result.selectionStart), editor.offsetToPos(start + result.selectionEnd));
      },
    });
    this.addCommand({ id: 'cycle-surface', name: 'Cycle Focus / Glass / Portable', callback: async () => {
      this.settings.surface = SURFACES[(SURFACES.indexOf(this.settings.surface) + 1) % SURFACES.length];
      await this.persist();
      new Notice(`Personal Glass: ${this.settings.surface}`);
    } });
    this.addSettingTab(new GlassSettingTab(this.app, this));
    this.registerEvent(this.app.workspace.on('window-open', (_workspaceWindow, win) => this.applyDocument(win.document)));
    this.registerEvent(this.app.workspace.on('window-close', (_workspaceWindow, win) => {
      const state = this.surfaces.get(win.document);
      if (state) this.restore(state);
      this.surfaces.delete(win.document);
    }));
    this.app.workspace.onLayoutReady(() => this.applyAll());
  }
  async persist() {
    this.settings = normalizeSettings(this.settings);
    await this.saveData(this.settings);
    this.applyAll();
  }
  applyAll() {
    if (this.settings.material === 'none') this.native.dispose();
    this.applyDocument(document);
    this.app.workspace.iterateAllLeaves(leaf => {
      const doc = leaf.view.containerEl.ownerDocument;
      if (doc !== document) this.applyDocument(doc);
    });
    for (const doc of this.surfaces.keys()) if (doc !== document) this.applyDocument(doc);
  }
  applyDocument(doc: Document) {
    const body = doc.body;
    if (!body) return;
    if (!this.surfaces.has(doc)) this.surfaces.set(doc, {
      body, attributes: new Map(ATTRS.map(attr => [attr, body.getAttribute(attr)])),
      width: body.style.getPropertyValue('--personal-content-width'),
      widthPriority: body.style.getPropertyPriority('--personal-content-width'),
    });
    body.setAttribute('data-personal-palette', this.settings.palette);
    body.setAttribute('data-personal-surface', this.settings.surface);
    body.setAttribute('data-personal-images', this.settings.roundedImages ? 'rounded' : 'square');
    body.setAttribute('data-personal-motion', this.settings.reduceMotion ? 'reduced' : 'system');
    body.style.setProperty('--personal-content-width', `${this.settings.contentWidth}px`);
    const result = this.native.apply(this.getNativeWindow(doc), this.settings.material, Platform.isWin);
    body.setAttribute('data-personal-native', result.active ? 'active' : 'off');
    this.nativeStatus = result.message;
  }
  private getNativeWindow(doc: Document): NativeWindow | null {
    if (this.settings.material === 'none' || !Platform.isDesktopApp || !Platform.isWin) return null;
    try {
      const remote = require('@electron/remote') as { getCurrentWindow(): NativeWindow; BrowserWindow?: { fromId(id: number): NativeWindow } };
      if (doc === document) return remote.getCurrentWindow();
      // Popout renderer contexts may not expose require. Never apply the main window API to a popout.
      const child = doc.defaultView as (Window & { require?: (name: string) => { getCurrentWindow(): NativeWindow } }) | null;
      return child?.require?.('@electron/remote')?.getCurrentWindow() ?? null;
    } catch { return null; }
  }
  private restore(state: SurfaceState) {
    for (const [attr, value] of state.attributes) {
      if (value === null) state.body.removeAttribute(attr); else state.body.setAttribute(attr, value);
    }
    if (state.width) state.body.style.setProperty('--personal-content-width', state.width, state.widthPriority);
    else state.body.style.removeProperty('--personal-content-width');
  }
  onunload() {
    this.native.dispose();
    for (const state of this.surfaces.values()) this.restore(state);
    this.surfaces.clear();
  }
}
class GlassSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: PersonalGlass) { super(app, plugin); }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Personal Glass' });
    containerEl.createEl('p', { text: 'The theme controls document styling. These settings are local to this plugin; no notes are scanned or reorganized.' });
    new Setting(containerEl).setName('Palette').addDropdown(drop => {
      for (const key of PALETTES) drop.addOption(key, { warm: 'Warm Neutral', mineral: 'Mineral', rose: 'Rose Stone' }[key]);
      drop.setValue(this.plugin.settings.palette).onChange(async value => {
        this.plugin.settings = normalizeSettings({ ...this.plugin.settings, palette: value }); await this.plugin.persist();
      });
    });
    new Setting(containerEl).setName('Surface').setDesc('Focus prioritizes reading; Glass exposes more background; Portable uses an in-app gradient.').addDropdown(drop => {
      for (const key of SURFACES) drop.addOption(key, key);
      drop.setValue(this.plugin.settings.surface).onChange(async value => {
        this.plugin.settings = normalizeSettings({ ...this.plugin.settings, surface: value }); await this.plugin.persist();
      });
    });
    new Setting(containerEl).setName('Windows native material').setDesc('Experimental, opt-in. Requires Windows 11 22H2+, a compatible Electron runtime and a hidden/Obsidian window frame. Do not combine with another native-material plugin.').addDropdown(drop => {
      for (const key of MATERIALS) drop.addOption(key, key === 'tabbed' ? 'Mica Alt (tabbed)' : key);
      drop.setValue(this.plugin.settings.material).onChange(async value => {
        this.plugin.settings = normalizeSettings({ ...this.plugin.settings, material: value }); await this.plugin.persist(); this.display();
      });
    });
    containerEl.createEl('p', { text: this.plugin.nativeStatus });
    new Setting(containerEl).setName('Rounded images').addToggle(toggle => toggle.setValue(this.plugin.settings.roundedImages).onChange(async value => {
      this.plugin.settings.roundedImages = value; await this.plugin.persist();
    }));
    new Setting(containerEl).setName('Reduce motion').setDesc('System reduced-motion preferences are always respected.').addToggle(toggle => toggle.setValue(this.plugin.settings.reduceMotion).onChange(async value => {
      this.plugin.settings.reduceMotion = value; await this.plugin.persist();
    }));
    new Setting(containerEl).setName('Content width').addSlider(slider => slider.setLimits(640, 1100, 20).setValue(this.plugin.settings.contentWidth).setDynamicTooltip().onChange(async value => {
      this.plugin.settings.contentWidth = value; await this.plugin.persist();
    }));
  }
}
