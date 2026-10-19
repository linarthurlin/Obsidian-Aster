import { FuzzySuggestModal, Plugin, ItemView, PluginSettingTab, Setting, MarkdownView, Notice, TFile, TFolder, parseFrontMatterAliases, type App, type WorkspaceLeaf } from 'obsidian';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir } from 'node:fs/promises';
import { normalizeSettings, type Settings } from './settings';
import { registerCorpusSearchInvalidation } from './corpus-search-lifecycle';
import { ChatView, ASTER_CHAT_VIEW } from './chat-view';
import { listNotes, visiblePath, resolveScope, prepareContext, prepareBatchContext, contextDigest, assertContextFresh, suggestionPlan, batchSuggestionPlan, getCorpusLinkHealth, getCorpusTitleCollisions, getCorpusZeroByteNotes, getCorpusAliasCollisions, invalidateCorpusSearchIndex, type Context, type Reviewed } from '../workflow/corpus.mjs';
import { runCodex, runBatchCodex } from '../workflow/codex.mjs';
import { apply, listTransactionJournals, readTransactionReview, recoverTransactionJournal, rollbackTransactionJournal, review as reviewPlan, safePath } from '../workflow/knowledge.mjs';
import { renderProposalReviewCard, type ProposalReviewCard } from './proposal-review';
import { RESEARCH_LIMITS, assertResearchSourcesFresh, buildResearchDraft, buildResearchSourceSet, researchEvidenceIds } from '../workflow/research.mjs';
const VIEW = 'knowledge-agent-workbench';
class CorpusFolderPicker extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private folders: TFolder[], private onChooseFolder: (folder: TFolder) => void) {
    super(app);
    this.setPlaceholder('Choose a visible Corpus folder');
    this.setInstructions([{ command: '↑↓', purpose: 'navigate' }, { command: '↵', purpose: 'validate and select' }]);
  }
  getItems() { return this.folders; }
  getItemText(folder: TFolder) { return folder.path; }
  onChooseItem(folder: TFolder) { this.onChooseFolder(folder); }
}
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
    root.createEl('p', { text: 'Select a Corpus folder and one or more target notes, inspect the exact context, then request a Codex proposal. No background scanning or automatic edits.' });
    const scope = root.createEl('p', { cls: 'pga-status', text: 'Corpus: ' + (this.plugin.settings.corpusFolder || 'Choose a folder in Settings → Aster') });
    const query = root.createEl('input', { type: 'text', placeholder: 'Find source evidence…', attr: { 'aria-label': 'Source query', maxlength: '1000' } });
    const targets = root.createEl('select', { attr: { 'aria-label': 'Target notes, select one or more', multiple: 'multiple', size: '6' } });
    targets.createEl('option', { value: '', text: 'Load notes from the selected folder' });
    root.createEl('p', { text: 'Select one target, or Ctrl-click up to four notes for an independently reviewable multi-note proposal.' });
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
    const historyActions = root.createDiv({ cls: 'pga-actions' });
    const historyButton = historyActions.createEl('button', { text: 'Transaction history / 交易紀錄' });
    const historyArea = root.createDiv({ cls: 'pga-results pga-transaction-history' });
    const curatorActions = root.createDiv({ cls: 'pga-actions' });
    const curatorButton = curatorActions.createEl('button', { text: 'Run Corpus metadata review / 檢查 Corpus 中繼資料' });
    const curatorArea = root.createDiv({ cls: 'pga-results pga-curator' });
    const researchPanel = root.createEl('details', { cls: 'pga-research' });
    researchPanel.createEl('summary', { text: 'Research Desk / 研究工作台' });
    researchPanel.createEl('p', { text: 'Select one to six Markdown notes, including Zotero-imported annotation notes. Aster extracts bounded prose, heading/line locators, Zotero page links and source hashes. Direct PDF extraction is not enabled. Nothing is sent until you review and press Send in Chat.' });
    const researchQuestion = researchPanel.createEl('input', { type: 'text', placeholder: 'What question should the selected sources answer?', attr: { 'aria-label': 'Research question', maxlength: '1000' } });
    const researchSources = researchPanel.createEl('select', { attr: { 'aria-label': 'Research Desk source notes', multiple: 'multiple', size: '6' } });
    researchSources.createEl('option', { value: '', text: 'Load scoped notes, then select up to six sources' });
    const researchActions = researchPanel.createDiv({ cls: 'pga-actions' });
    const previewResearch = researchActions.createEl('button', { text: 'Preview selected evidence / 預覽研究來源' }); previewResearch.disabled = true;
    const prepareResearchChat = researchActions.createEl('button', { text: 'Prepare Chat draft / 建立聊天草稿' }); prepareResearchChat.disabled = true;
    const researchStatus = researchPanel.createDiv({ cls: 'pga-status', attr: { role: 'status', 'aria-live': 'polite' }, text: 'Select source notes and review their exact evidence before preparing a draft.' });
    const researchPreview = researchPanel.createDiv({ cls: 'pga-research-preview', attr: { 'aria-label': 'Research source preview' } });
    type WorkbenchContext = Context | Awaited<ReturnType<typeof prepareBatchContext>>;
    let corpus = '', context: WorkbenchContext | undefined, reviewed: Reviewed | null = null;
    let researchSet: ReturnType<typeof buildResearchSourceSet> | undefined;
    let researchDraft = '', researchCorpus = '', researchFolder = '', researchGeneration = 0;
    let historyLoading = false, curatorLoading = false;
    const invalidate = () => { ++this.generation; context = undefined; reviewed = null; consent.checked = false; send.disabled = true; contextArea.empty(); resultArea.empty(); };
    const invalidateResearch = () => {
      ++researchGeneration; researchSet = undefined; researchDraft = ''; researchCorpus = ''; researchFolder = '';
      researchPreview.empty(); prepareResearchChat.disabled = true;
      previewResearch.disabled = !researchQuestion.value.trim() || !researchSources.selectedOptions.length;
    };
    const report = (error: unknown) => {
      if (this.closed) return;
      const detail = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message : typeof error === 'string' ? error : 'Operation failed.';
      status.setText(detail);
    };
    const locked = (busy: boolean) => {
      load.disabled = busy; prepare.disabled = busy || !targets.value; query.disabled = busy; targets.disabled = busy; consent.disabled = busy;
      send.disabled = busy || !context || !consent.checked; cancel.disabled = !busy; historyButton.disabled = busy || historyLoading; curatorButton.disabled = busy || curatorLoading;
      researchQuestion.disabled = busy; researchSources.disabled = busy;
      previewResearch.disabled = busy || !researchQuestion.value.trim() || !researchSources.selectedOptions.length;
      prepareResearchChat.disabled = busy || !researchSet;
    };
    const openCorpusNote = async (relativePath: string, selectedFolder: string, selectedCorpus: string) => {
      const rootPath = await this.plugin.corpus();
      if (rootPath !== selectedCorpus || this.plugin.settings.corpusFolder !== selectedFolder) throw new Error('Corpus changed. Run the link check again before opening a result.');
      if (!(await listNotes(rootPath)).includes(relativePath)) throw new Error('This note is no longer inside the configured Corpus.');
      const vaultPath = selectedFolder + '/' + relativePath;
      const file = this.app.vault.getAbstractFileByPath(vaultPath);
      if (!(file instanceof TFile) || file.path !== vaultPath) throw new Error('Obsidian could not resolve this note inside the selected Corpus.');
      const leaf = this.app.workspace.getLeaf('tab');
      await leaf.openFile(file);
      await this.app.workspace.revealLeaf(leaf);
    };
    const showTransactionReview = async (transaction: { path: string; status: string; targetPaths: string[] }, container: HTMLElement, selectedCorpus: string) => {
      container.empty();
      try {
        if (await this.plugin.corpus() !== selectedCorpus) throw new Error('Corpus changed. Reopen transaction history for the selected scope.');
        const detail = await readTransactionReview(selectedCorpus, transaction.path);
        if (this.closed) return;
        container.createEl('h4', { text: 'Transaction details · ' + detail.status });
        for (const change of detail.changes) {
          const section = container.createEl('details');
          section.createEl('summary', { text: change.path + ' · ' + change.reason });
          section.createEl('pre', { text: change.diff, cls: 'pga-code' });
          for (const source of change.sources) {
            section.createEl('h5', { text: source.path + (source.locator ? ' · ' + source.locator : '') });
            section.createEl('blockquote', { text: source.excerpt });
          }
        }
        const targetList = container.createEl('ul', { cls: 'pga-transaction-targets' });
        for (const target of detail.targets) targetList.createEl('li', { text: target.path + ' · ' + target.state });
        container.createEl('p', { text: 'Review loads only this saved transaction and hashes its scoped targets locally. It does not send note text to Codex.' });
        const safe = detail.targets.every(target => target.state === 'before' || target.state === 'after');
        const canRecover = ['pending', 'recovering', 'recovery-required'].includes(detail.status);
        const canRollback = detail.status === 'applied';
        if (!canRecover && !canRollback) {
          container.createEl('p', { text: 'This transaction has no available recovery action.' });
          return;
        }
        const approval = container.createEl('label', { cls: 'pga-consent' });
        const checkbox = approval.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
        approval.createSpan({ text: 'I reviewed these diffs and explicitly approve restoring the before-state.' });
        checkbox.disabled = !safe;
        const action = container.createEl('button', { text: canRecover ? 'Recover interrupted transaction' : 'Rollback this transaction' });
        action.disabled = !safe || !checkbox.checked;
        checkbox.onchange = () => { action.disabled = !safe || !checkbox.checked; };
        action.onclick = async () => {
          if (!safe || !checkbox.checked) return;
          action.disabled = true; locked(true);
          try {
            if (await this.plugin.corpus() !== selectedCorpus) throw new Error('Corpus changed. No transaction files were restored.');
            const result = canRecover
              ? await recoverTransactionJournal(selectedCorpus, transaction.path)
              : await rollbackTransactionJournal(selectedCorpus, transaction.path);
            container.createEl('p', { text: 'Transaction restored to its before-state. ' + result.restored + ' file(s) restored.' });
            status.setText('Transaction restored. Later edits were protected by target hash checks.');
          } catch (error) {
            container.createEl('p', { text: error instanceof Error ? error.message : 'Transaction recovery failed.' });
            action.disabled = false;
          } finally { if (!this.closed) locked(false); }
        };
        if (!safe) container.createEl('p', { text: 'Recovery is blocked because a target is missing or differs from both reviewed versions. No files were changed.' });
      } catch (error) {
        if (!this.closed) container.createEl('p', { text: error instanceof Error ? error.message : 'Could not load this transaction.' });
      }
    };
    const loadHistory = async () => {
      if (historyLoading) return;
      historyLoading = true; historyButton.disabled = true; historyArea.empty();
      try {
        const selectedCorpus = await this.plugin.corpus();
        const historyDirectory = join(homedir(), '.knowledge-agent', 'transactions');
        const history = await listTransactionJournals(selectedCorpus, historyDirectory);
        if (this.closed) return;
        historyArea.createEl('h3', { text: 'Local transaction history' });
        historyArea.createEl('p', { text: 'Private journals are filtered to the configured Corpus. Nothing is sent to Codex.' });
        if (history.skipped) historyArea.createEl('p', { text: history.skipped + ' unreadable, unrelated or older transaction record(s) were skipped.' });
        if (!history.items.length) historyArea.createEl('p', { text: 'No Aster transaction journals were found for this Corpus.' });
        for (const transaction of history.items) {
          const entry = historyArea.createDiv({ cls: 'pga-transaction-entry' });
          entry.createEl('h4', { text: transaction.createdAt + ' · ' + transaction.status });
          entry.createEl('p', { text: transaction.targetPaths.join(', ') });
          const details = entry.createDiv({ cls: 'pga-transaction-detail' });
          const reviewButton = entry.createEl('button', { text: 'Review diffs and status' });
          reviewButton.onclick = () => showTransactionReview(transaction, details, selectedCorpus);
        }
      } catch (error) { if (!this.closed) historyArea.createEl('p', { text: error instanceof Error ? error.message : 'Could not load transaction history.' }); }
      finally { historyLoading = false; if (!this.closed) historyButton.disabled = false; }
    };
    historyButton.onclick = () => loadHistory();
    curatorButton.onclick = async () => {
      if (curatorLoading) return;
      curatorLoading = true; locked(true); curatorArea.empty();
      try {
        const selectedFolder = this.plugin.settings.corpusFolder;
        if (!selectedFolder) throw new Error('Choose a Corpus folder in Settings → Aster first.');
        const selectedCorpus = await this.plugin.corpus();
        const notePaths = await listNotes(selectedCorpus);
        const health = getCorpusLinkHealth(selectedFolder, notePaths, this.app.metadataCache.resolvedLinks, this.app.metadataCache.unresolvedLinks);
        const titleCollisions = getCorpusTitleCollisions(selectedFolder, notePaths);
        const fileSizes: Record<string, number> = {};
        const aliasesByPath: Record<string, string[]> = {};
        for (const path of notePaths) {
          const vaultPath = selectedFolder + '/' + path;
          const file = this.app.vault.getAbstractFileByPath(vaultPath);
          if (!(file instanceof TFile) || file.path !== vaultPath) throw new Error('Corpus changed during metadata inspection. Run the report again.');
          fileSizes[path] = file.stat.size;
          const cached = this.app.metadataCache.getFileCache(file);
          if (!cached) throw new Error('Corpus alias metadata is not ready for every note. Run the report again.');
          aliasesByPath[path] = parseFrontMatterAliases(cached.frontmatter) || [];
        }
        const zeroByteNotes = getCorpusZeroByteNotes(selectedFolder, notePaths, fileSizes);
        const aliasCollisions = getCorpusAliasCollisions(selectedFolder, notePaths, aliasesByPath);
        if (await this.plugin.corpus() !== selectedCorpus || this.plugin.settings.corpusFolder !== selectedFolder) throw new Error('Corpus changed while the link report was being prepared. Run it again.');
        if (this.closed) return;
        curatorArea.createEl('h3', { text: 'Corpus metadata review · read-only' });
        curatorArea.createEl('p', { text: 'This on-demand report reads the configured Corpus path list, Obsidian’s link index and cached frontmatter aliases, and file-size metadata only. It does not read note bodies, call Codex, or change files.' });
        curatorArea.createEl('p', { text: `${health.unresolved.length} unresolved link target(s); ${health.noInbound.length} note(s) without an inbound link from this Corpus; ${titleCollisions.length} repeated-title group(s); ${zeroByteNotes.length} zero-byte note(s); ${aliasCollisions.length} alias collision group(s).` });
        if (aliasCollisions.length) {
          const details = curatorArea.createEl('details');
          details.createEl('summary', { text: `Alias collision candidates · ${aliasCollisions.length} groups` });
          details.createEl('p', { text: 'This check compares Obsidian-cached frontmatter aliases with Corpus note filenames, using case-insensitive NFKC and collapsed whitespace. Repeated aliases can be intentional; review each match before changing properties or links.' });
          for (const finding of aliasCollisions.slice(0, 100)) {
            const entry = details.createDiv({ cls: 'pga-curator-finding' });
            entry.createEl('strong', { text: finding.alias });
            for (const match of finding.matches) {
              const row = entry.createDiv({ cls: 'pga-curator-finding' });
              const evidence = [match.filename ? 'filename' : '', ...match.aliases.map(alias => `alias: ${alias}`)].filter(Boolean).join(' · ');
              row.createEl('span', { text: `${match.path} · ${evidence}` });
              const open = row.createEl('button', { text: 'Open note' });
              open.onclick = async () => {
                open.disabled = true;
                try { await openCorpusNote(match.path, selectedFolder, selectedCorpus); }
                catch (error) { if (!this.closed) row.createEl('p', { text: error instanceof Error ? error.message : 'Could not open the note.' }); }
                finally { if (!this.closed) open.disabled = false; }
              };
            }
          }
          if (aliasCollisions.length > 100) details.createEl('p', { text: `Showing 100 of ${aliasCollisions.length} alias collision groups.` });
        } else curatorArea.createEl('p', { text: 'No repeated frontmatter aliases or alias-to-filename collisions were found inside this Corpus.' });
        if (zeroByteNotes.length) {
          const details = curatorArea.createEl('details');
          details.createEl('summary', { text: `Zero-byte Markdown notes · ${zeroByteNotes.length} review candidates` });
          details.createEl('p', { text: 'This check uses Obsidian file-size metadata only. A zero-byte note may be an intentional placeholder; no note body was read.' });
          for (const path of zeroByteNotes.slice(0, 100)) {
            const row = details.createDiv({ cls: 'pga-curator-finding' });
            row.createEl('span', { text: path });
            const open = row.createEl('button', { text: 'Open note' });
            open.onclick = async () => {
              open.disabled = true;
              try { await openCorpusNote(path, selectedFolder, selectedCorpus); }
              catch (error) { if (!this.closed) row.createEl('p', { text: error instanceof Error ? error.message : 'Could not open the note.' }); }
              finally { if (!this.closed) open.disabled = false; }
            };
          }
          if (zeroByteNotes.length > 100) details.createEl('p', { text: `Showing 100 of ${zeroByteNotes.length} zero-byte notes.` });
        } else curatorArea.createEl('p', { text: 'No zero-byte Markdown files were found inside this Corpus.' });
        if (titleCollisions.length) {
          const details = curatorArea.createEl('details');
          details.createEl('summary', { text: `Repeated note titles · ${titleCollisions.length} disambiguation candidates` });
          details.createEl('p', { text: 'This filename-only check groups matching Markdown titles in this Corpus, ignoring case and Unicode compatibility differences. Matching titles may be intentional; review each path before changing links.' });
          for (const finding of titleCollisions.slice(0, 100)) {
            const entry = details.createDiv({ cls: 'pga-curator-finding' });
            entry.createEl('strong', { text: finding.title });
            for (const path of finding.paths) {
              const row = entry.createDiv({ cls: 'pga-curator-finding' });
              row.createEl('span', { text: path });
              const open = row.createEl('button', { text: 'Open note' });
              open.onclick = async () => {
                open.disabled = true;
                try { await openCorpusNote(path, selectedFolder, selectedCorpus); }
                catch (error) { if (!this.closed) row.createEl('p', { text: error instanceof Error ? error.message : 'Could not open the note.' }); }
                finally { if (!this.closed) open.disabled = false; }
              };
            }
          }
          if (titleCollisions.length > 100) details.createEl('p', { text: `Showing 100 of ${titleCollisions.length} title groups.` });
        } else curatorArea.createEl('p', { text: 'No repeated note titles were found inside this Corpus.' });
        if (health.unresolved.length) {
          curatorArea.createEl('h4', { text: 'Unresolved link targets · review candidates' });
          curatorArea.createEl('p', { text: 'An unresolved link may point to a renamed note or alias, or contain a typo. This report does not classify it as a confirmed broken link.' });
          for (const finding of health.unresolved.slice(0, 100)) {
            const entry = curatorArea.createDiv({ cls: 'pga-curator-finding' });
            entry.createEl('strong', { text: `${finding.target} · ${finding.count} occurrence(s)` });
            entry.createEl('p', { text: 'Source: ' + finding.sourcePath });
            const open = entry.createEl('button', { text: 'Open source note' });
            open.onclick = async () => {
              open.disabled = true;
              try { await openCorpusNote(finding.sourcePath, selectedFolder, selectedCorpus); }
              catch (error) { if (!this.closed) entry.createEl('p', { text: error instanceof Error ? error.message : 'Could not open the source note.' }); }
              finally { if (!this.closed) open.disabled = false; }
            };
          }
          if (health.unresolved.length > 100) curatorArea.createEl('p', { text: `Showing 100 of ${health.unresolved.length} unresolved entries.` });
        } else curatorArea.createEl('p', { text: 'No unresolved links were reported for notes in this Corpus.' });
        if (health.noInbound.length) {
          const details = curatorArea.createEl('details');
          details.createEl('summary', { text: `Notes without inbound Corpus links · ${health.noInbound.length} candidates` });
          details.createEl('p', { text: 'These may be intentionally independent notes or linked from outside the selected Corpus; absence of an inbound Corpus link is not proof of an orphan.' });
          for (const path of health.noInbound.slice(0, 100)) {
            const row = details.createDiv({ cls: 'pga-curator-finding' });
            row.createEl('span', { text: path });
            const open = row.createEl('button', { text: 'Open note' });
            open.onclick = async () => {
              open.disabled = true;
              try { await openCorpusNote(path, selectedFolder, selectedCorpus); }
              catch (error) { if (!this.closed) row.createEl('p', { text: error instanceof Error ? error.message : 'Could not open the note.' }); }
              finally { if (!this.closed) open.disabled = false; }
            };
          }
          if (health.noInbound.length > 100) details.createEl('p', { text: `Showing 100 of ${health.noInbound.length} candidates.` });
        }
      } catch (error) {
        if (!this.closed) curatorArea.createEl('p', { text: error instanceof Error ? error.message : 'Could not prepare the Corpus link report.' });
      } finally { curatorLoading = false; if (!this.closed) locked(false); }
    };
    this.registerDomEvent(query, 'input', invalidate);
    this.registerDomEvent(targets, 'change', () => { invalidate(); prepare.disabled = !targets.selectedOptions.length; });
    this.registerDomEvent(researchQuestion, 'input', invalidateResearch);
    this.registerDomEvent(researchSources, 'change', invalidateResearch);
    this.registerDomEvent(consent, 'change', () => { send.disabled = !context || !consent.checked || !!this.abort; });
    cancel.onclick = () => this.abort?.abort();
    load.onclick = async () => {
      invalidate(); invalidateResearch(); locked(true);
      try {
        corpus = await this.plugin.corpus(); const notes = await listNotes(corpus);
        if (this.closed) return;
        targets.empty(); targets.createEl('option', { value: '', text: 'Select an existing target note' });
        for (const path of notes) targets.createEl('option', { value: path, text: path });
        researchSources.empty(); researchSources.createEl('option', { value: '', text: 'Ctrl-click to select one to six source notes' });
        for (const path of notes) researchSources.createEl('option', { value: path, text: path });
        scope.setText('Corpus: ' + this.plugin.settings.corpusFolder);
        status.setText(notes.length + ' scoped Markdown files. Metadata only; no bodies sent.');
      } catch (error) { targets.value = ''; report(error); } finally { if (!this.closed) locked(false); }
    };
    previewResearch.onclick = async () => {
      invalidateResearch();
      const generation = researchGeneration;
      const paths = Array.from(researchSources.selectedOptions).map(option => option.value).filter(Boolean);
      const selectedFolder = this.plugin.settings.corpusFolder;
      locked(true);
      try {
        if (!researchQuestion.value.trim()) throw new Error('Enter a research question before previewing sources.');
        if (!paths.length || paths.length > RESEARCH_LIMITS.sources) throw new Error('Select between one and six Research Desk source notes.');
        const selectedCorpus = await this.plugin.corpus();
        const available = new Set(await listNotes(selectedCorpus));
        const inputs = [];
        for (const path of paths) {
          if (!visiblePath(path) || !path.endsWith('.md') || !available.has(path)) throw new Error('A selected source left the configured Corpus. Reload and select it again.');
          const absolute = await safePath(selectedCorpus, path);
          const stat = await lstat(absolute);
          if (stat.isSymbolicLink() || !stat.isFile() || stat.size > RESEARCH_LIMITS.sourceBytes) throw new Error('Each selected Research source must be a regular Markdown file up to 200,000 bytes.');
          const vaultPath = selectedFolder + '/' + path;
          const file = this.app.vault.getAbstractFileByPath(vaultPath);
          if (!(file instanceof TFile) || file.path !== vaultPath) throw new Error('Obsidian could not resolve this source inside the selected Corpus: ' + path);
          const content = await this.app.vault.read(file);
          if (Buffer.byteLength(content, 'utf8') > RESEARCH_LIMITS.sourceBytes) throw new Error('A selected source exceeds the 200,000-byte Research limit: ' + path);
          const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
          const metadataText = (value: unknown) => {
            if (typeof value === 'string' || typeof value === 'number') return String(value);
            if (Array.isArray(value)) return value.filter(item => typeof item === 'string' || typeof item === 'number').map(String).join(', ');
            return '';
          };
          inputs.push({ path, content,
            title: metadataText(frontmatter?.title),
            citationKey: metadataText(frontmatter?.citekey ?? frontmatter?.citationKey ?? frontmatter?.['citation-key']),
            author: metadataText(frontmatter?.author ?? frontmatter?.authors),
            year: metadataText(frontmatter?.year),
          });
        }
        if (this.closed || generation !== researchGeneration) return;
        if (this.plugin.settings.corpusFolder !== selectedFolder || await this.plugin.corpus() !== selectedCorpus) throw new Error('Corpus changed while reading sources. Reload and preview again.');
        researchSet = buildResearchSourceSet(researchQuestion.value, inputs);
        researchDraft = buildResearchDraft(researchSet);
        researchCorpus = selectedCorpus;
        researchFolder = selectedFolder;
        researchPreview.empty();
        researchPreview.createEl('h4', { text: 'Exact editable Chat draft / 完整聊天草稿' });
        researchPreview.createEl('p', { text: `${researchSet.sources.length} source note(s) · ${researchEvidenceIds(researchSet).length} evidence block(s) · ${researchSet.totalEvidenceChars.toLocaleString()} evidence characters. Note content is untrusted source material; Chat does not start automatically.` });
        researchPreview.createEl('pre', { text: researchDraft, cls: 'pga-code' });
        researchStatus.setText('Source hashes and locators are ready. Review the exact draft above; select Prepare Chat draft to copy it to an editable, unsent Chat.');
      } catch (error) {
        researchSet = undefined; researchDraft = ''; researchPreview.empty();
        researchStatus.setText(error instanceof Error ? error.message : 'Could not prepare the selected Research sources.');
      } finally { if (!this.closed) locked(false); }
    };
    prepareResearchChat.onclick = async () => {
      if (!researchSet || !researchDraft) return;
      const selectedSet = researchSet, selectedDraft = researchDraft, selectedRoot = researchCorpus, selectedFolder = researchFolder;
      const generation = researchGeneration;
      locked(true);
      try {
        if (this.plugin.settings.corpusFolder !== selectedFolder || await this.plugin.corpus() !== selectedRoot) throw new Error('Corpus changed. Preview the selected sources again.');
        await assertResearchSourcesFresh(selectedRoot, selectedSet);
        if (this.closed || generation !== researchGeneration) return;
        await this.plugin.openChat();
        const leaf = this.app.workspace.getLeavesOfType(ASTER_CHAT_VIEW)[0];
        if (!(leaf?.view instanceof ChatView)) throw new Error('Aster Chat is not available.');
        await leaf.view.startResearchDraft(selectedDraft, selectedSet.question, researchEvidenceIds(selectedSet));
        researchStatus.setText('An independent Chat contains the editable, unsent Research draft. Review it and press Send only when ready.');
      } catch (error) {
        researchStatus.setText(error instanceof Error ? error.message : 'Could not prepare the Research Chat draft.');
      } finally { if (!this.closed) locked(false); }
    };
    prepare.onclick = async () => {
      invalidate(); const generation = this.generation; const targetPaths = Array.from(targets.selectedOptions).map(option => option.value).filter(Boolean); locked(true);
      try {
        // Resolve again in case settings changed after the metadata list was loaded.
        if (!targetPaths.length) throw new Error('Select at least one existing target note.');
        corpus = await this.plugin.corpus();
        const captured = targetPaths.length > 1
          ? await prepareBatchContext(corpus, query.value, targetPaths)
          : await prepareContext(corpus, query.value, targetPaths[0]);
        if (this.closed || generation !== this.generation) return;
        context = captured;
        contextArea.createEl('h3', { text: 'Exact model context / 實際送出內容' });
        contextArea.createEl('p', { text: 'targets' in context
          ? 'The selected target notes (at most four and 48,000 characters combined) plus up to six bounded source excerpts are sent. No other note bodies are sent. Codex uses your CLI account; this is an external model request.'
          : 'One complete target note and up to six bounded source excerpts. No other note bodies are sent. Codex uses your CLI account; this is an external model request.' });
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
        const options = { approvedDigest: contextDigest(approved), executable: this.plugin.settings.executable || undefined,
          model: this.plugin.settings.model || undefined, signal: abort.signal };
        let suggestionReason = '';
        if ('targets' in approved) {
          const suggestion = await runBatchCodex(approved, options);
          suggestionReason = suggestion.reason;
          reviewed = await batchSuggestionPlan(corpus, approved, suggestion);
        } else {
          const suggestion = await runCodex(approved, options);
          suggestionReason = suggestion.reason;
          reviewed = await suggestionPlan(corpus, approved, suggestion);
        }
        if (this.closed || abort.signal.aborted || generation !== this.generation) return;
        if (this.closed || generation !== this.generation) return;
        consent.checked = false;
        if (!reviewed) { status.setText('No supported change proposed: ' + suggestionReason); return; }
        const candidate = reviewed;
        resultArea.createEl('h3', { text: 'Review proposal / 審核提案' });
        resultArea.createEl('p', { text: suggestionReason + ` · ${candidate.review.changes.length} independently reviewable change(s).` });
        resultArea.createEl('p', { text: 'Exact excerpts prove quotation presence, not that the reasoning is correct. Review formulas, claims and preserved content yourself.' });
        const cards: ProposalReviewCard[] = [];
        for (const change of candidate.review.changes) {
          const operation = candidate.plan.operations.find(item => item.path === change.path);
          if (!operation) throw new Error('Proposal operation is missing for ' + change.path);
          const card = renderProposalReviewCard(resultArea, change, {
            setBusy: busy => { cards.forEach(item => item.setExternalBusy(busy)); locked(busy); },
            apply: async () => {
              if (reviewed !== candidate) throw new Error('Proposal is no longer current. Prepare and review a new context.');
              if (await this.plugin.corpus() !== corpus) throw new Error('Corpus changed. Prepare a new proposal.');
              const singlePlan = { ...candidate.plan, operations: [operation] };
              const singleReview = reviewPlan(singlePlan);
              const journal = join(homedir(), '.knowledge-agent', 'transactions'); await mkdir(journal, { recursive: true });
              const receipt = join(journal, singlePlan.id + '-' + randomUUID() + '.private.json');
              await apply(corpus, singlePlan, singleReview.digest, receipt);
              context = undefined;
              status.setText('Applied ' + change.path + '. Other reviewed items remain separate and unchanged.');
              return receipt;
            },
            rollback: async receipt => {
              if (await this.plugin.corpus() !== corpus) throw new Error('Corpus changed. Reopen transaction history for the original scope.');
              await rollbackTransactionJournal(corpus, receipt);
              status.setText('Rolled back ' + change.path + '. Later human edits are protected by target hash checks.');
            },
          });
          cards.push(card);
        }
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
  private savedCorpusFolder = '';
  private stopCorpusSearchInvalidation?: () => void;
  async onload() {
    this.settings = normalizeSettings(await this.loadData());
    this.savedCorpusFolder = this.settings.corpusFolder;
    this.registerView(VIEW, leaf => new Workbench(leaf, this));
    this.registerView(ASTER_CHAT_VIEW, leaf => new ChatView(leaf, this));
    this.addCommand({ id: 'open-workbench', name: 'Open knowledge review workbench', callback: () => this.openWorkbench() });
    this.addCommand({ id: 'open-chat', name: 'Open Aster Chat', callback: () => this.openChat() });
    this.addCommand({ id: 'quick-ask-selection', name: 'Quick Ask: selected text', callback: () => this.quickAskSelection() });
    this.addCommand({ id: 'attach-active-note', name: 'Attach active note to Aster draft', callback: () => this.attachActiveNote() });
    this.addSettingTab(new AgentSettings(this.app, this));
    this.stopCorpusSearchInvalidation = registerCorpusSearchInvalidation(this.app, eventRef => this.registerEvent(eventRef));
  }
  async corpus() {
    const adapter = this.app.vault.adapter as unknown as { getBasePath?: () => string };
    if (!adapter.getBasePath) throw new Error('A desktop filesystem vault is required.');
    return resolveScope(adapter.getBasePath(), this.settings.corpusFolder);
  }
  async saveSettings() {
    this.settings = normalizeSettings(this.settings);
    if (this.settings.corpusFolder !== this.savedCorpusFolder) {
      this.savedCorpusFolder = this.settings.corpusFolder;
      invalidateCorpusSearchIndex();
    }
    const snapshot = this.settings; this.saveQueue = this.saveQueue.catch(() => {}).then(() => this.saveData(snapshot)); await this.saveQueue;
  }
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
  onunload() {
    this.stopCorpusSearchInvalidation?.();
    this.app.workspace.detachLeavesOfType(VIEW); this.app.workspace.detachLeavesOfType(ASTER_CHAT_VIEW);
    invalidateCorpusSearchIndex();
  }
}
class AgentSettings extends PluginSettingTab {
  constructor(app: App, private plugin: KnowledgeAgent) { super(app, plugin); }
  display() {
    const root = this.containerEl; root.empty(); root.createEl('h2', { text: 'Aster' });
    const corpusSetting = new Setting(root).setName('Corpus folder / 資料範圍').setDesc('Choose or type a visible vault-relative folder. Whole-vault scope and linked folders are rejected. Only path metadata is used to populate the chooser; note content is read only by an explicit workflow.');
    corpusSetting.addText(text => text.setPlaceholder('Research/Selected').setValue(this.plugin.settings.corpusFolder).onChange(async value => { this.plugin.settings.corpusFolder = value; await this.plugin.saveSettings(); }));
    corpusSetting.addButton(button => button.setButtonText('Choose folder…').setTooltip('Choose a visible folder in this vault for the Aster Corpus').onClick(() => {
      const folders = this.app.vault.getAllFolders(false).filter(folder => visiblePath(folder.path)).sort((a, b) => a.path.localeCompare(b.path));
      if (!folders.length) { new Notice('No visible Corpus folders are available. Create a folder or enter its path in Aster settings.'); return; }
      new CorpusFolderPicker(this.app, folders, folder => {
        void (async () => {
          try {
            if (!(folder instanceof TFolder) || !visiblePath(folder.path)) throw new Error('Choose a visible vault-relative folder.');
            const adapter = this.app.vault.adapter as unknown as { getBasePath?: () => string };
            if (!adapter.getBasePath) throw new Error('A desktop filesystem vault is required to validate the Corpus folder.');
            await resolveScope(adapter.getBasePath(), folder.path);
            this.plugin.settings.corpusFolder = folder.path;
            await this.plugin.saveSettings();
            this.display();
            new Notice('Aster Corpus set to ' + folder.path + '.');
          } catch (error) {
            new Notice(error instanceof Error ? error.message : 'Could not select the Corpus folder.');
          }
        })();
      }).open();
    }));
    new Setting(root).setName('Codex CLI executable').setDesc('Optional absolute path to your trusted codex executable. Empty uses installed Codex/PATH; .cmd/.bat/.ps1 wrappers are not supported.')
      .addText(text => text.setValue(this.plugin.settings.executable).onChange(async value => { this.plugin.settings.executable = value; await this.plugin.saveSettings(); }));
    new Setting(root).setName('Default model').setDesc('Default for new chats. Each chat can override this after loading the Codex model catalog. Empty uses the CLI default.')
      .addText(text => text.setValue(this.plugin.settings.model).onChange(async value => { this.plugin.settings.model = value; await this.plugin.saveSettings(); }));
    new Setting(root).setName('Default thinking').setDesc('Default for new chats. Model-specific choices are loaded from Codex when available.')
      .addDropdown(dropdown => dropdown.addOption('', 'Provider default').addOption('low', 'Low').addOption('medium', 'Medium').addOption('high', 'High').addOption('xhigh', 'Extra high').setValue(this.plugin.settings.thinking).onChange(async value => { this.plugin.settings.thinking = value; await this.plugin.saveSettings(); }));
    root.createEl('p', { text: 'No API keys are stored by this plugin. Chat transcripts stay in the local user profile outside the Vault; plugin settings keep only chat metadata. Chat includes note text only when you explicitly add it to the visible draft, or enable read-only Corpus tools for a chat. Corpus tool excerpts and note text are sent to the selected Codex model; the tools cannot edit or delete notes. The Knowledge Studio separately sends only the context you preview and approve. Transaction journals stay outside the vault under your home directory.' });
  }
}
