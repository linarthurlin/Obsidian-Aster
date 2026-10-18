import { Plugin, ItemView, PluginSettingTab, Setting, MarkdownView, Notice, type App, type WorkspaceLeaf } from 'obsidian';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { normalizeSettings, type Settings } from './settings';
import { ChatView, ASTER_CHAT_VIEW } from './chat-view';
import { listNotes, resolveScope, prepareContext, contextDigest, assertContextFresh, suggestionPlan, type Context, type Reviewed } from '../workflow/corpus.mjs';
import { runCodex } from '../workflow/codex.mjs';
import { apply, rollback } from '../workflow/knowledge.mjs';
const VIEW = 'knowledge-agent-workbench';
class Workbench extends ItemView {
  private abort?: AbortController;
  private closed = false;
  private generation = 0;
  constructor(leaf: WorkspaceLeaf, private plugin: KnowledgeAgent) { super(leaf); }
  getViewType() { return VIEW; }
  getDisplayText() { return 'Aster'; }
  getIcon() { return 'notebook-pen'; }
  async onOpen() {
    this.closed = false;
    const root = this.contentEl; root.empty(); root.addClass('pga-workbench');
    root.createEl('h2', { text: 'Aster' });
    root.createEl('p', { text: 'Select a folder and target, inspect the context, then request a Codex proposal. No background scanning or automatic edits.' });
    const scope = root.createEl('p', { cls: 'pga-status', text: 'Corpus: ' + (this.plugin.settings.corpusFolder || 'Choose a folder in Settings → Aster') });
    const query = root.createEl('input', { type: 'text', placeholder: 'Find source evidence…', attr: { 'aria-label': 'Source query', maxlength: '1000' } });
    const targets = root.createEl('select', { attr: { 'aria-label': 'Target note' } });
    targets.createEl('option', { value: '', text: 'Load notes from the selected folder' });
    const actions = root.createDiv({ cls: 'pga-actions' });
    const load = actions.createEl('button', { text: 'Load scoped notes / 載入範圍' });
    const prepare = actions.createEl('button', { text: 'Preview context / 預覽內容' }); prepare.disabled = true;
    const consentLabel = root.createEl('label', { cls: 'pga-consent' });
    const consent = consentLabel.createEl('input', { type: 'checkbox' });
    consentLabel.createSpan({ text: 'I approve sending the exact target and excerpts shown below to Codex / 同意傳送下列內容' });
    const sendActions = root.createDiv({ cls: 'pga-actions' });
    const send = sendActions.createEl('button', { text: 'Ask Codex / 產生提案' }); send.disabled = true;
    const cancel = sendActions.createEl('button', { text: 'Cancel / 取消' }); cancel.disabled = true;
    const status = root.createDiv({ cls: 'pga-status', attr: { role: 'status', 'aria-live': 'polite' }, text: 'No note bodies loaded. Nothing sent.' });
    const contextArea = root.createDiv({ cls: 'pga-context' });
    const resultArea = root.createDiv({ cls: 'pga-results' });
    let corpus = '', context: Context | undefined, reviewed: Reviewed | null = null, receipt = '';
    const invalidate = () => { ++this.generation; context = undefined; reviewed = null; consent.checked = false; send.disabled = true; contextArea.empty(); resultArea.empty(); };
    const report = (error: unknown) => { if (!this.closed) status.setText(error instanceof Error ? error.message : 'Operation failed.'); };
    const locked = (busy: boolean) => { load.disabled = busy; prepare.disabled = busy || !targets.value; query.disabled = busy; targets.disabled = busy; consent.disabled = busy; send.disabled = busy || !context || !consent.checked; cancel.disabled = !busy; };
    this.registerDomEvent(query, 'input', invalidate);
    this.registerDomEvent(targets, 'change', () => { invalidate(); prepare.disabled = !targets.value; });
    this.registerDomEvent(consent, 'change', () => { send.disabled = !context || !consent.checked || !!this.abort; });
    cancel.onclick = () => this.abort?.abort();
    load.onclick = async () => {
      invalidate(); locked(true);
      try {
        corpus = await this.plugin.corpus(); const notes = await listNotes(corpus);
        if (this.closed) return;
        targets.empty(); targets.createEl('option', { value: '', text: 'Select an existing target note' });
        for (const path of notes) targets.createEl('option', { value: path, text: path });
        scope.setText('Corpus: ' + this.plugin.settings.corpusFolder);
        status.setText(notes.length + ' scoped Markdown files. Metadata only; no bodies sent.');
      } catch (error) { targets.value = ''; report(error); } finally { if (!this.closed) locked(false); }
    };
    prepare.onclick = async () => {
      invalidate(); const generation = this.generation; locked(true);
      try {
        // Resolve again in case settings changed after the metadata list was loaded.
        corpus = await this.plugin.corpus(); const captured = await prepareContext(corpus, query.value, targets.value);
        if (this.closed || generation !== this.generation) return;
        context = captured;
        contextArea.createEl('h3', { text: 'Exact model context / 實際送出內容' });
        contextArea.createEl('p', { text: 'One complete target note and up to six bounded source excerpts. No other note bodies are sent. Codex uses your CLI account; this is an external model request.' });
        contextArea.createEl('pre', { text: JSON.stringify(context, null, 2), cls: 'pga-code' });
        status.setText(context.sources.length + ' source excerpts prepared. Review before checking consent.');
      } catch (error) { report(error); } finally { if (!this.closed) locked(false); }
    };
    send.onclick = async () => {
      if (!context || !consent.checked || this.abort) return;
      const approved = context; const generation = this.generation;
      const abort = this.abort = new AbortController(); locked(true); resultArea.empty();
      try {
        if (await this.plugin.corpus() !== corpus) throw new Error('Corpus changed. Reload and preview again.');
        await assertContextFresh(corpus, approved);
        status.setText('Codex is generating a proposal. No note edits are allowed.');
        const suggestion = await runCodex(approved, { approvedDigest: contextDigest(approved), executable: this.plugin.settings.executable || undefined,
          model: this.plugin.settings.model || undefined, signal: abort.signal });
        if (this.closed || abort.signal.aborted || generation !== this.generation) return;
        reviewed = await suggestionPlan(corpus, approved, suggestion);
        if (this.closed || generation !== this.generation) return;
        consent.checked = false;
        if (!reviewed) { status.setText('No supported change proposed: ' + suggestion.reason); return; }
        const candidate = reviewed;
        resultArea.createEl('h3', { text: 'Review proposal / 審核提案' });
        resultArea.createEl('p', { text: suggestion.reason });
        resultArea.createEl('pre', { text: candidate.review.changes[0].diff, cls: 'pga-code' });
        for (const source of candidate.review.changes[0].sources) {
          resultArea.createEl('h4', { text: source.path + ' · ' + source.locator });
          resultArea.createEl('blockquote', { text: source.excerpt });
        }
        resultArea.createEl('p', { text: 'Exact excerpts prove quotation presence, not that the reasoning is correct. Review formulas, claims and preserved content yourself.' });
        const reviewLabel = resultArea.createEl('label', { cls: 'pga-consent' }); const approvedEdit = reviewLabel.createEl('input', { type: 'checkbox' });
        reviewLabel.createSpan({ text: 'I reviewed this diff and its evidence / 已審核差異與證據' });
        const applyButton = resultArea.createEl('button', { text: 'Apply this reviewed update / 套用此更新' }); applyButton.disabled = true;
        const rollbackButton = resultArea.createEl('button', { text: 'Rollback this update / 回復此更新' }); rollbackButton.disabled = true;
        approvedEdit.onchange = () => { applyButton.disabled = !approvedEdit.checked; };
        applyButton.onclick = async () => {
          if (!approvedEdit.checked || reviewed !== candidate) return;
          applyButton.disabled = true; approvedEdit.disabled = true; locked(true);
          try {
            if (await this.plugin.corpus() !== corpus) throw new Error('Corpus changed. Prepare a new proposal.');
            const journal = join(homedir(), '.knowledge-agent', 'transactions'); await mkdir(journal, { recursive: true });
            receipt = join(journal, candidate.plan.id + '-' + randomUUID() + '.private.json');
            await apply(corpus, candidate.plan, candidate.review.digest, receipt);
            rollbackButton.disabled = false; reviewed = null; context = undefined;
            status.setText('Applied one reviewed update. Recovery journal: ' + receipt);
          } catch (error) { report(error); } finally { if (!this.closed) locked(false); }
        };
        rollbackButton.onclick = async () => {
          rollbackButton.disabled = true; locked(true);
          try { await rollback(corpus, JSON.parse(await readFile(receipt, 'utf8'))); status.setText('Update rolled back. Later human edits are never overwritten.'); }
          catch (error) { report(error); rollbackButton.disabled = false; } finally { if (!this.closed) locked(false); }
        };
        status.setText('Proposal validated locally. No notes changed; read the diff and evidence.');
      } catch (error) { report(error); }
      finally { this.abort = undefined; if (!this.closed) locked(false); }
    };
  }
  async onClose() { this.closed = true; ++this.generation; this.abort?.abort(); this.contentEl.empty(); }
}
export default class KnowledgeAgent extends Plugin {
  settings: Settings = normalizeSettings(null);
  private saveQueue: Promise<void> = Promise.resolve();
  async onload() {
    this.settings = normalizeSettings(await this.loadData());
    this.registerView(VIEW, leaf => new Workbench(leaf, this));
    this.registerView(ASTER_CHAT_VIEW, leaf => new ChatView(leaf, this));
    this.addCommand({ id: 'open-workbench', name: 'Open knowledge review workbench', callback: () => this.openWorkbench() });
    this.addCommand({ id: 'open-chat', name: 'Open Aster Chat', callback: () => this.openChat() });
    this.addCommand({ id: 'quick-ask-selection', name: 'Quick Ask: selected text', callback: () => this.quickAskSelection() });
    this.addCommand({ id: 'attach-active-note', name: 'Attach active note to Aster draft', callback: () => this.attachActiveNote() });
    this.addSettingTab(new AgentSettings(this.app, this));
  }
  async corpus() {
    const adapter = this.app.vault.adapter as unknown as { getBasePath?: () => string };
    if (!adapter.getBasePath) throw new Error('A desktop filesystem vault is required.');
    return resolveScope(adapter.getBasePath(), this.settings.corpusFolder);
  }
  async saveSettings() { this.settings = normalizeSettings(this.settings); const snapshot = this.settings; this.saveQueue = this.saveQueue.catch(() => {}).then(() => this.saveData(snapshot)); await this.saveQueue; }
  async openWorkbench() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf('tab'); await leaf.setViewState({ type: VIEW, active: true }); }
    await this.app.workspace.revealLeaf(leaf);
  }
  async quickAskSelection() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const selection = view?.editor.getSelection() ?? '';
    if (!view || !selection.trim()) { new Notice('Select text in a Markdown note before using Quick Ask.'); return; }
    if (selection.length > 12_000) { new Notice('Quick Ask supports selections up to 12,000 characters. Narrow the selection and try again.'); return; }
    if (!view.file) { new Notice('Quick Ask could not identify the selected note.'); return; }
    await this.openChat();
    const leaf = this.app.workspace.getLeavesOfType(ASTER_CHAT_VIEW)[0];
    const chat = leaf?.view;
    if (!(chat instanceof ChatView)) { new Notice('Aster Chat is not available.'); return; }
    await chat.startQuickAskDraft(selection, view.file.path);
  }
  async attachActiveNote() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) { new Notice('Open a Markdown note before attaching the active note to Aster Chat.'); return; }
    const content = view.editor.getValue();
    if (!content.trim()) { new Notice('The active Markdown note is empty; nothing was added.'); return; }
    if (content.length > 24_000) { new Notice('Aster can attach up to 24,000 characters from the active note. No content was added.'); return; }
    const path = view.file.path;
    await this.openChat();
    const leaf = this.app.workspace.getLeavesOfType(ASTER_CHAT_VIEW)[0];
    const chat = leaf?.view;
    if (!(chat instanceof ChatView)) { new Notice('Aster Chat is not available.'); return; }
    try { await chat.attachNoteToDraft(content, path); }
    catch (error) { new Notice(error instanceof Error ? error.message : 'Could not attach the active note.'); }
  }
  async openChat() {
    let leaf = this.app.workspace.getLeavesOfType(ASTER_CHAT_VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf('tab'); await leaf.setViewState({ type: ASTER_CHAT_VIEW, active: true }); }
    await this.app.workspace.revealLeaf(leaf);
  }
  onunload() { this.app.workspace.detachLeavesOfType(VIEW); this.app.workspace.detachLeavesOfType(ASTER_CHAT_VIEW); }
}
class AgentSettings extends PluginSettingTab {
  constructor(app: App, private plugin: KnowledgeAgent) { super(app, plugin); }
  display() {
    const root = this.containerEl; root.empty(); root.createEl('h2', { text: 'Aster' });
    new Setting(root).setName('Corpus folder / 資料範圍').setDesc('Required visible folder relative to the vault. Whole-vault scope and linked folders are rejected. Nothing scans in the background.')
      .addText(text => text.setPlaceholder('Research/Selected').setValue(this.plugin.settings.corpusFolder).onChange(async value => { this.plugin.settings.corpusFolder = value; await this.plugin.saveSettings(); }));
    new Setting(root).setName('Codex CLI executable').setDesc('Optional absolute path to your trusted codex executable. Empty uses installed Codex/PATH; .cmd/.bat/.ps1 wrappers are not supported.')
      .addText(text => text.setValue(this.plugin.settings.executable).onChange(async value => { this.plugin.settings.executable = value; await this.plugin.saveSettings(); }));
    new Setting(root).setName('Default model').setDesc('Default for new chats. Each chat can override this after loading the Codex model catalog. Empty uses the CLI default.')
      .addText(text => text.setValue(this.plugin.settings.model).onChange(async value => { this.plugin.settings.model = value; await this.plugin.saveSettings(); }));
    new Setting(root).setName('Default thinking').setDesc('Default for new chats. Model-specific choices are loaded from Codex when available.')
      .addDropdown(dropdown => dropdown.addOption('', 'Provider default').addOption('low', 'Low').addOption('medium', 'Medium').addOption('high', 'High').addOption('xhigh', 'Extra high').setValue(this.plugin.settings.thinking).onChange(async value => { this.plugin.settings.thinking = value; await this.plugin.saveSettings(); }));
    root.createEl('p', { text: 'No API keys are stored by this plugin. Chat transcripts stay in the local user profile outside the Vault; plugin settings keep only chat metadata, and Chat requests never attach Vault notes. The Knowledge Studio separately sends only the context you preview and approve. Transaction journals stay outside the vault under your home directory.' });
  }
}
