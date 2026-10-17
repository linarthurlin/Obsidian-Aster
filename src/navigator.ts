import { ItemView, TFile, TFolder, Menu, setIcon, getAllTags, type WorkspaceLeaf } from 'obsidian';
import type PersonalGlass from './main';
import { filterFiles, previewText, type NavigationFile, type NavigationScope } from './navigator-model';
export const NAVIGATOR_VIEW = 'personal-glass-navigator';
const PAGE_SIZE = 80;
export class GlassNavigator extends ItemView {
  private navScope: NavigationScope = 'all';
  private folder = '';
  private query = '';
  private type: 'notes' | 'attachments' | 'all' = 'notes';
  private descendants = true;
  private sort: 'name' | 'modified' = 'name';
  private showSources = true;
  private limit = PAGE_SIZE;
  private generation = 0;
  private timer: number | undefined;
  private cache = new Map<string, { mtime: number; text: string }>();
  private sources!: HTMLElement;
  private list!: HTMLElement;
  private status!: HTMLElement;
  private scopeLabel!: HTMLElement;
  private search!: HTMLInputElement;
  private root!: HTMLElement;
  private selected = '';
  constructor(leaf: WorkspaceLeaf, private plugin: PersonalGlass) { super(leaf); }
  getViewType() { return NAVIGATOR_VIEW; }
  getDisplayText() { return 'Personal Glass Navigator'; }
  getIcon() { return 'panels-left-bottom'; }
  async onOpen() {
    this.contentEl.empty();
    this.root = this.contentEl.createDiv({ cls: 'pg-navigator' });
    const header = this.root.createDiv({ cls: 'pg-nav-header' });
    header.createDiv({ cls: 'pg-nav-brand', text: 'Your space' });
    const tools = header.createDiv({ cls: 'pg-nav-toolbar' });
    this.button(tools, 'Browse folders', 'folder-tree', () => {
      this.showSources = !this.showSources; this.render();
    });
    this.button(tools, 'Reveal current file', 'locate-fixed', () => this.revealCurrent());
    this.button(tools, 'Open Notebook Navigator (if installed)', 'panels-left-right', () => this.plugin.openNotebookNavigator());
    this.search = header.createEl('input', { type: 'search', placeholder: 'Search names, aliases or #tags…', attr: { 'aria-label': 'Search navigator' } });
    this.registerDomEvent(this.search, 'input', () => {
      this.query = this.search.value; this.limit = PAGE_SIZE; this.render();
    });
    this.registerDomEvent(this.search, 'keydown', event => {
      if (event.key === 'Escape') { this.query = ''; this.search.value = ''; this.render(); }
      if (event.key === 'ArrowDown') { event.preventDefault(); this.list.querySelector<HTMLButtonElement>('.pg-file')?.focus(); }
    });
    const filters = header.createDiv({ cls: 'pg-nav-filters' });
    const type = filters.createEl('select', { attr: { 'aria-label': 'File types' } });
    for (const [value, label] of [['notes', 'Notes'], ['attachments', 'Attachments'], ['all', 'All files']]) type.createEl('option', { value, text: label });
    this.registerDomEvent(type, 'change', () => { this.type = type.value as typeof this.type; this.limit = PAGE_SIZE; this.render(); });
    const sort = filters.createEl('select', { attr: { 'aria-label': 'Sort files' } });
    for (const [value, label] of [['name', 'Name'], ['modified', 'Modified']]) sort.createEl('option', { value, text: label });
    this.registerDomEvent(sort, 'change', () => { this.sort = sort.value as typeof this.sort; this.render(); });
    const nested = filters.createEl('label', { cls: 'pg-nav-nested' });
    const checkbox = nested.createEl('input', { type: 'checkbox', attr: { 'aria-label': 'Include subfolders' } });
    checkbox.checked = true; nested.createSpan({ text: 'Subfolders' });
    this.registerDomEvent(checkbox, 'change', () => { this.descendants = checkbox.checked; this.render(); });
    const panes = this.root.createDiv({ cls: 'pg-nav-panes' });
    this.sources = panes.createEl('nav', { cls: 'pg-nav-sources', attr: { 'aria-label': 'Browse scopes and folders' } });
    const results = panes.createDiv({ cls: 'pg-nav-results' });
    this.scopeLabel = results.createDiv({ cls: 'pg-nav-scope' });
    this.list = results.createDiv({ cls: 'pg-nav-list', attr: { role: 'list', 'aria-label': 'Files' } });
    this.status = this.root.createDiv({ cls: 'pg-nav-status', attr: { role: 'status', 'aria-live': 'polite' } });
    this.registerDomEvent(this.list, 'keydown', event => this.navigate(event));
    this.registerEvent(this.app.vault.on('create', () => this.schedule()));
    this.registerEvent(this.app.vault.on('delete', file => { this.cache.delete(file.path); this.schedule(); }));
    this.registerEvent(this.app.vault.on('rename', () => this.schedule()));
    this.registerEvent(this.app.vault.on('modify', file => { this.cache.delete(file.path); this.schedule(); }));
    this.registerEvent(this.app.metadataCache.on('changed', () => this.schedule()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.schedule()));
    this.render();
  }
  private button(parent: HTMLElement, label: string, icon: string, action: () => void) {
    const button = parent.createEl('button', { cls: 'pg-nav-icon', attr: { 'aria-label': label, title: label } });
    setIcon(button, icon); button.onclick = action; return button;
  }
  private schedule() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.render(), 150);
  }
  private selectScope(scope: NavigationScope, folder = '') {
    this.navScope = scope; this.folder = folder; this.showSources = false; this.limit = PAGE_SIZE; this.render();
  }
  revealCurrent() {
    const current = this.app.workspace.getActiveFile();
    if (!current) return;
    this.query = current.path; this.search.value = current.path; this.type = 'all';
    const type = this.root.querySelector<HTMLSelectElement>('[aria-label="File types"]');
    if (type) type.value = 'all';
    this.selected = current.path;
    this.selectScope('folder', current.parent?.path === '/' ? '' : current.parent?.path || '');
    this.list.querySelector<HTMLButtonElement>(`[data-path="${CSS.escape(current.path)}"]`)?.scrollIntoView({ block: 'nearest' });
  }
  refresh() { if (this.root?.isConnected) this.render(); }
  render() {
    if (!this.root?.isConnected) return;
    const generation = ++this.generation;
    this.root.dataset.layout = this.plugin.settings.navigatorLayout;
    this.root.dataset.sources = String(this.showSources);
    this.sources.empty();
    for (const [scope, label, icon] of [['all', 'All notes', 'notebook-text'], ['recent', 'Recently opened', 'history'], ['pinned', 'Pinned', 'pin']] as const) {
      const button = this.sources.createEl('button', { cls: 'pg-nav-source', text: label, attr: { 'aria-pressed': String(this.navScope === scope) } });
      const marker = button.createSpan({ cls: 'pg-nav-source-icon' }); setIcon(marker, icon); button.prepend(marker);
      button.onclick = () => this.selectScope(scope);
    }
    this.sources.createDiv({ cls: 'pg-nav-section', text: 'Folders' });
    if (this.folder) {
      const back = this.sources.createEl('button', { cls: 'pg-nav-source', text: '← Parent folder' });
      back.onclick = () => this.selectScope('folder', this.folder.includes('/') ? this.folder.slice(0, this.folder.lastIndexOf('/')) : '');
    }
    const folder = this.app.vault.getAbstractFileByPath(this.folder || '/') || this.app.vault.getRoot();
    const folders = folder instanceof TFolder ? folder.children.filter((child): child is TFolder => child instanceof TFolder) : [];
    folders.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant', { numeric: true }));
    for (const child of folders) {
      const button = this.sources.createEl('button', { cls: 'pg-nav-source', text: child.name, attr: { title: child.path } });
      const icon = button.createSpan({ cls: 'pg-nav-source-icon' }); setIcon(icon, 'folder'); button.prepend(icon);
      button.onclick = () => this.selectScope('folder', child.path);
    }
    this.scopeLabel.empty();
    this.scopeLabel.createSpan({ text: this.navScope === 'folder' ? this.folder || 'Vault root' : { all: 'All notes', recent: 'Recently opened', pinned: 'Pinned' }[this.navScope] });
    if (this.navScope !== 'all') {
      const reset = this.scopeLabel.createEl('button', { text: 'All', attr: { 'aria-label': 'Search entire vault' } });
      reset.onclick = () => this.selectScope('all');
    }
    const files: NavigationFile[] = this.app.vault.getFiles().map(file => {
      const cache = this.app.metadataCache.getFileCache(file);
      const aliases = cache?.frontmatter?.aliases;
      return { path: file.path, name: file.basename, extension: file.extension, mtime: file.stat.mtime,
        aliases: Array.isArray(aliases) ? aliases.filter((v): v is string => typeof v === 'string') : typeof aliases === 'string' ? [aliases] : [],
        tags: cache ? getAllTags(cache) || [] : [] };
    });
    const results = filterFiles(files, { scope: this.navScope, folder: this.folder, query: this.query, type: this.type,
      descendants: this.descendants, sort: this.sort, pinned: this.plugin.settings.pinnedPaths, recent: this.plugin.settings.recentPaths });
    const focusedPath = (this.contentEl.ownerDocument.activeElement as HTMLElement | null)?.dataset.path;
    this.list.empty();
    const active = this.app.workspace.getActiveFile()?.path;
    const previews: Array<{ file: TFile; element: HTMLElement }> = [];
    for (const info of results.slice(0, this.limit)) {
      const file = this.app.vault.getAbstractFileByPath(info.path);
      if (!(file instanceof TFile)) continue;
      const row = this.list.createDiv({ cls: 'pg-nav-row', attr: { role: 'listitem' } });
      const button = row.createEl('button', { cls: 'pg-file', attr: { 'data-path': file.path, title: file.path, 'aria-current': file.path === active ? 'page' : 'false' } });
      button.classList.toggle('is-selected', this.selected === file.path);
      const icon = button.createSpan({ cls: 'pg-file-icon' });
      setIcon(icon, ({ md: 'file-text', canvas: 'layout-dashboard', base: 'database', pdf: 'file-type', svg: 'image', png: 'image', jpg: 'image' } as Record<string, string>)[file.extension] || 'file');
      const content = button.createSpan({ cls: 'pg-file-content' });
      content.createSpan({ cls: 'pg-file-title', text: file.basename });
      content.createSpan({ cls: 'pg-file-path', text: file.parent?.path === '/' ? file.extension.toUpperCase() : file.parent?.path || file.extension.toUpperCase() });
      if (this.plugin.settings.navigatorPreviews && file.extension === 'md') previews.push({ file, element: content.createSpan({ cls: 'pg-file-preview' }) });
      button.onclick = event => { this.selected = file.path; void this.app.workspace.getLeaf(event.ctrlKey || event.metaKey ? 'tab' : false).openFile(file); };
      button.oncontextmenu = event => {
        event.preventDefault();
        const menu = new Menu();
        menu.addItem(item => item.setTitle('Open in new tab').setIcon('file-plus').onClick(() => this.app.workspace.getLeaf('tab').openFile(file)));
        menu.addItem(item => item.setTitle(this.plugin.settings.pinnedPaths.includes(file.path) ? 'Unpin' : 'Pin').setIcon('pin').onClick(async () => {
          this.plugin.settings.pinnedPaths = this.plugin.settings.pinnedPaths.includes(file.path)
            ? this.plugin.settings.pinnedPaths.filter(path => path !== file.path) : [...this.plugin.settings.pinnedPaths, file.path];
          await this.plugin.persist(); this.render();
        }));
        menu.showAtMouseEvent(event);
      };
    }
    if (results.length > this.limit) {
      const more = this.list.createEl('button', { cls: 'pg-nav-more', text: `Show next ${PAGE_SIZE}` });
      more.onclick = () => { this.limit += PAGE_SIZE; this.render(); };
    }
    if (!results.length) {
      this.list.createDiv({ cls: 'pg-nav-empty', text: this.navScope === 'pinned' ? 'Pin a file from its context menu.' : 'No matching files in this scope.' });
      const clear = this.list.createEl('button', { text: 'Clear filters' });
      clear.onclick = () => { this.query = ''; this.search.value = ''; this.type = 'all';
        const type = this.root.querySelector<HTMLSelectElement>('[aria-label="File types"]'); if (type) type.value = 'all'; this.selectScope('all'); };
    }
    this.status.setText(`${results.length} files · ${this.navScope === 'folder' ? this.descendants ? 'including subfolders' : 'this folder only' : 'read-only browsing'}`);
    if (focusedPath) this.list.querySelector<HTMLButtonElement>(`[data-path="${CSS.escape(focusedPath)}"]`)?.focus({ preventScroll: true });
    void this.loadPreviews(previews, generation);
  }
  private async loadPreviews(items: Array<{ file: TFile; element: HTMLElement }>, generation: number) {
    // Sequential and bounded: no full-vault body index and at most one read in flight.
    for (const { file, element } of items) {
      if (generation !== this.generation) return;
      try {
        let cached = this.cache.get(file.path);
        if (!cached || cached.mtime !== file.stat.mtime) {
          if (file.stat.size > 200000) continue;
          cached = { mtime: file.stat.mtime, text: previewText(await this.app.vault.cachedRead(file)) };
          this.cache.set(file.path, cached);
          if (this.cache.size > 120) this.cache.delete(this.cache.keys().next().value!);
        }
        if (generation === this.generation && element.isConnected) element.setText(cached.text);
      } catch { /* file may have been renamed or deleted */ }
    }
  }
  private navigate(event: KeyboardEvent) {
    const rows = Array.from(this.list.querySelectorAll<HTMLButtonElement>('.pg-file'));
    const focused = this.contentEl.ownerDocument.activeElement;
    const index = rows.indexOf(focused as HTMLButtonElement);
    let next = index;
    if (event.key === 'ArrowDown') next = Math.min(rows.length - 1, index + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = rows.length - 1;
    else if (event.key === 'Escape') { this.search.focus(); return; }
    else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && index >= 0) {
      event.preventDefault(); const file = this.app.vault.getAbstractFileByPath(rows[index].dataset.path!);
      if (file instanceof TFile) void this.app.workspace.getLeaf('tab').openFile(file); return;
    } else return;
    event.preventDefault(); rows[next]?.focus();
  }
  async onClose() { ++this.generation; window.clearTimeout(this.timer); this.cache.clear(); this.contentEl.empty(); }
}
