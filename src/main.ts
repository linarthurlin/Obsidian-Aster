import { Plugin, PluginSettingTab, Setting, Notice, Platform, type App } from 'obsidian';
import { DEFAULT_SETTINGS, normalizeSettings, PALETTES, SURFACES, MATERIALS, type GlassSettings } from './settings';
import { TEMPLATES, createInsertion } from './commands';
import { NativeMaterialController, type NativeWindow } from './native';
import { GlassNavigator, NAVIGATOR_VIEW } from './navigator';
import { rememberPath, relocatePaths } from './navigator-model';
import { selectionVariables } from './selection';

declare const require: (name: string) => unknown;
interface SurfaceState {
  body: HTMLElement;
  attributes: Map<string, string | null>;
  width: string;
  widthPriority: string;
  selectionStyles: Map<string, { value: string; priority: string }>;
}
const ATTRS = ['data-personal-palette', 'data-personal-surface', 'data-personal-images', 'data-personal-motion', 'data-personal-native'];
export default class PersonalGlass extends Plugin {
  settings: GlassSettings = { ...DEFAULT_SETTINGS };
  native = new NativeMaterialController();
  nativeStatus = 'Native material is off.';
  private surfaces = new Map<Document, SurfaceState>();
  private active = false;
  private saveQueue: Promise<void> = Promise.resolve();

  async onload() {
    this.active = true;
    this.settings = normalizeSettings(await this.loadData());
    this.registerView(NAVIGATOR_VIEW, leaf => new GlassNavigator(leaf, this));
    this.addCommand({ id: 'open-navigator', name: 'Open read-only Navigator / 檔案導覽', callback: () => this.openNavigator() });
    this.addCommand({ id: 'open-notebook-navigator', name: 'Open Notebook Navigator integration', callback: () => this.openNotebookNavigator() });
    this.addRibbonIcon('panels-left-bottom', 'Personal Glass Navigator', () => { void this.openNavigator(); });
    this.registerEvent(this.app.workspace.on('file-open', file => {
      if (!file) return;
      this.settings.recentPaths = rememberPath(this.settings.recentPaths, file.path);
      void this.persist();
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      this.settings.recentPaths = relocatePaths(this.settings.recentPaths, oldPath, file.path);
      this.settings.pinnedPaths = relocatePaths(this.settings.pinnedPaths, oldPath, file.path);
      void this.persist();
    }));
    this.registerEvent(this.app.vault.on('delete', file => {
      const keep = (path: string) => path !== file.path && !path.startsWith(file.path + '/');
      this.settings.recentPaths = this.settings.recentPaths.filter(keep);
      this.settings.pinnedPaths = this.settings.pinnedPaths.filter(keep);
      void this.persist();
    }));
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
    const snapshot = this.settings;
    this.saveQueue = this.saveQueue.catch(() => {}).then(() => this.saveData(snapshot));
    await this.saveQueue;
    this.applyAll();
    this.refreshNavigators();
  }
  refreshNavigators() {
    for (const leaf of this.app.workspace.getLeavesOfType(NAVIGATOR_VIEW)) (leaf.view as GlassNavigator).refresh();
  }
  async openNavigator() {
    let leaf = this.app.workspace.getLeavesOfType(NAVIGATOR_VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeftLeaf(false)!;
      if (!leaf) return;
      await leaf.setViewState({ type: NAVIGATOR_VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }
  async openNotebookNavigator() {
    const host = this.app as App & { plugins?: { getPlugin(id: string): unknown } };
    const installed = host.plugins?.getPlugin('notebook-navigator');
    if (!installed) { new Notice('Notebook Navigator is optional. Opening the built-in read-only Navigator.'); await this.openNavigator(); return; }
    let leaf = this.app.workspace.getLeavesOfType('notebook-navigator')[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeftLeaf(false)!;
      if (!leaf) return;
      await leaf.setViewState({ type: 'notebook-navigator', active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }
  applyAll() {
    if (!this.active) return;
    if (this.settings.material === 'none') this.native.dispose();
    this.applyDocument(document);
    this.app.workspace.iterateAllLeaves(leaf => {
      const doc = leaf.view.containerEl.ownerDocument;
      if (doc !== document) this.applyDocument(doc);
    });
    for (const doc of this.surfaces.keys()) if (doc !== document) this.applyDocument(doc);
  }
  applyDocument(doc: Document) {
    if (!this.active) return;
    const body = doc.body;
    if (!body) return;
    if (!this.surfaces.has(doc)) this.surfaces.set(doc, {
      body, attributes: new Map(ATTRS.map(attr => [attr, body.getAttribute(attr)])),
      width: body.style.getPropertyValue('--personal-content-width'),
      widthPriority: body.style.getPropertyPriority('--personal-content-width'),
      selectionStyles: new Map(Object.keys(selectionVariables(this.settings)).map(key => [key, {
        value: body.style.getPropertyValue(key), priority: body.style.getPropertyPriority(key),
      }])),
    });
    body.setAttribute('data-personal-palette', this.settings.palette);
    body.setAttribute('data-personal-surface', this.settings.surface);
    body.setAttribute('data-personal-images', this.settings.roundedImages ? 'rounded' : 'square');
    body.setAttribute('data-personal-motion', this.settings.reduceMotion ? 'reduced' : 'system');
    body.style.setProperty('--personal-content-width', `${this.settings.contentWidth}px`);
    for (const [key, value] of Object.entries(selectionVariables(this.settings))) body.style.setProperty(key, value);
    const result = this.native.apply(this.getNativeWindow(doc), this.settings.material, Platform.isWin);
    body.setAttribute('data-personal-native', result.active ? 'active' : 'off');
    if (doc === document) this.nativeStatus = result.message;
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
    for (const [key, original] of state.selectionStyles) {
      if (original.value) state.body.style.setProperty(key, original.value, original.priority);
      else state.body.style.removeProperty(key);
    }
    for (const [attr, value] of state.attributes) {
      if (value === null) state.body.removeAttribute(attr); else state.body.setAttribute(attr, value);
    }
    if (state.width) state.body.style.setProperty('--personal-content-width', state.width, state.widthPriority);
    else state.body.style.removeProperty('--personal-content-width');
  }
  onunload() {
    this.active = false;
    this.native.dispose();
    for (const state of this.surfaces.values()) this.restore(state);
    this.surfaces.clear();
    this.app.workspace.detachLeavesOfType(NAVIGATOR_VIEW);
  }
}
class GlassSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: PersonalGlass) { super(app, plugin); }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Personal Glass' });
    containerEl.createEl('p', { text: 'Read-only navigation uses filenames and cached metadata. Optional previews read local Markdown; nothing is reorganized or sent to a server.' });
    new Setting(containerEl).setName('Open Navigator').setDesc('Folders, recent files, pins, aliases and tag filtering. No rename, move or delete operations.').addButton(button => button.setButtonText('Open').onClick(() => this.plugin.openNavigator()));
    new Setting(containerEl).setName('Navigator layout').addDropdown(drop => {
      for (const [value, text] of [['auto', 'Adaptive'], ['single', 'Compact'], ['dual', 'Dual pane']]) drop.addOption(value, text);
      drop.setValue(this.plugin.settings.navigatorLayout).onChange(async value => {
        this.plugin.settings = normalizeSettings({ ...this.plugin.settings, navigatorLayout: value }); await this.plugin.persist();
      });
    });
    new Setting(containerEl).setName('Local note previews').setDesc('Off by default. Reads only displayed Markdown rows; no AI or external images.').addToggle(toggle => toggle.setValue(this.plugin.settings.navigatorPreviews).onChange(async value => {
      this.plugin.settings.navigatorPreviews = value; await this.plugin.persist();
    }));
    containerEl.createEl('h3', { text: 'Selection glass / 文件選取玻璃' });
    containerEl.createEl('p', { text: 'Champagne × Sage by default. Light and dark colors are independent. Changes apply immediately to Navigator, native File explorer and the optional Notebook Navigator. Blur affects only the background; a uniform background may show little visible blur.' });
    const preview = containerEl.createDiv({ cls: 'pg-selection-preview', attr: { 'aria-label': 'Selection appearance preview' } });
    preview.createEl('strong', { text: 'Personal Glass' });
    preview.createSpan({ text: 'A quiet space for connected ideas' });
    for (const [key, label] of [
      ['selectionLightStart', 'Light · start color / 淺色起點'], ['selectionLightEnd', 'Light · end color / 淺色終點'],
      ['selectionDarkStart', 'Dark · start color / 深色起點'], ['selectionDarkEnd', 'Dark · end color / 深色終點'],
    ] as const) new Setting(containerEl).setName(label).addColorPicker(picker => picker.setValue(this.plugin.settings[key]).onChange(async value => {
      this.plugin.settings[key] = value; await this.plugin.persist();
    }));
    for (const [key, label, max, description] of [
      ['selectionLightOpacity', 'Light · color opacity / 淺色不透明度', 100, '10–100%. Lower values expose more background.'],
      ['selectionDarkOpacity', 'Dark · color opacity / 深色不透明度', 100, '10–100%. Keep enough fill to identify the current file.'],
      ['selectionGlass', 'Glass strength / 玻璃程度', 100, 'Controls inner highlights and soft shadow. 0 gives flat fill and disables blur.'],
      ['selectionBlur', 'Background blur / 背景模糊', 24, '0–24px. Never blurs the text. Requires glass strength above zero.'],
      ['selectionAngle', 'Gradient angle / 漸層方向', 360, '0–360 degrees.'],
    ] as const) new Setting(containerEl).setName(label).setDesc(description).addSlider(slider => slider
      .setLimits(key.includes('Opacity') ? 10 : 0, max, 1).setValue(this.plugin.settings[key]).setDynamicTooltip().onChange(async value => {
        this.plugin.settings[key] = value; await this.plugin.persist();
      }));
    new Setting(containerEl).setName('Reset selection / 回復選取預設').setDesc('Restore Champagne × Sage colors and glass settings only.').addButton(button => button.setButtonText('Reset').onClick(async () => {
      for (const key of Object.keys(DEFAULT_SETTINGS).filter(key => key.startsWith('selection')) as Array<keyof GlassSettings>) {
        Object.assign(this.plugin.settings, { [key]: DEFAULT_SETTINGS[key] });
      }
      await this.plugin.persist(); this.display();
    }));
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
