import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);

function fakeCodex() {
  const children: any[] = [];
  let threadId = 0, turnId = 0;
  const spawn = (_executable: string, args: string[]) => {
    const child: any = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.exitCode = null; child.signalCode = null; child.args = args; child.requests = [];
    let buffer = '';
    const send = (message: any) => setTimeout(() => child.stdout.write(JSON.stringify(message) + '\n'), 0);
    const close = () => {
      if (child.exitCode !== null) return;
      child.exitCode = 0; setTimeout(() => child.emit('close', 0), 0);
    };
    child.kill = () => { close(); return true; };
    child.stdin = new Writable({
      write(chunk, _encoding, callback) {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/); buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line) continue;
          const request = JSON.parse(line);
          child.requests.push(request);
          if (args[0] === '--version') continue;
          if (request.method === 'exit') { close(); continue; }
          if (request.method === 'initialized') continue;
          if (request.method === 'initialize') {
            send({ jsonrpc: '2.0', id: request.id, result: { serverInfo: { name: 'codex', version: '0.162.1' } } });
          } else if (request.method === 'thread/start') {
            send({ jsonrpc: '2.0', id: request.id, result: { thread: { id: 'ui-thread-' + (++threadId), ephemeral: false, threadSource: 'aster' } } });
          } else if (request.method === 'thread/name/set') {
            send({ jsonrpc: '2.0', id: request.id, result: {} });
          } else if (request.method === 'thread/resume') {
            send({ jsonrpc: '2.0', id: request.id, result: { thread: { id: request.params.threadId, ephemeral: false, threadSource: 'aster' } } });
          } else if (request.method === 'turn/start') {
            const id = 'ui-turn-' + (++turnId), activeThread = request.params.threadId;
            send({ jsonrpc: '2.0', id: request.id, result: { turn: { id, status: 'inProgress' } } });
            send({ jsonrpc: '2.0', method: 'item/agentMessage/delta', params: { threadId: activeThread, turnId: id, delta: 'Aster ' } });
            send({ jsonrpc: '2.0', method: 'item/agentMessage/delta', params: { threadId: activeThread, turnId: id, delta: 'stream' } });
            send({ jsonrpc: '2.0', method: 'thread/tokenUsage/updated', params: { threadId: activeThread, turnId: id,
              tokenUsage: { last: { totalTokens: 18000 }, total: { totalTokens: 22000 }, modelContextWindow: 22000 } } });
            send({ jsonrpc: '2.0', method: 'item/completed', params: { threadId: activeThread, turnId: id, item: { type: 'agentMessage', text: 'Aster stream' } } });
            send({ jsonrpc: '2.0', method: 'turn/completed', params: { threadId: activeThread, turn: { id, status: 'completed' } } });
          } else if (request.method === 'turn/interrupt') {
            send({ jsonrpc: '2.0', id: request.id, result: {} });
            send({ jsonrpc: '2.0', method: 'turn/completed', params: { threadId: request.params.threadId,
              turn: { id: request.params.turnId, status: 'interrupted' } } });
          } else send({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'not found' } });
        }
        callback();
      },
      final(callback) { close(); callback(); },
    });
    children.push(child);
    if (args[0] === '--version') setTimeout(() => { child.stdout.end('codex-cli 0.162.1\n'); close(); }, 0);
    return child;
  };
  return { spawn, children };
}

it('streams and resumes local Chat, and waits for a blocked transcript save before clearing chats', async () => {
  const testHome = await mkdtemp(join(tmpdir(), 'aster-chat-view-test-'));
  const dom = new JSDOM('<main></main>'), doc = dom.window.document;
  const factories = new Map<string, any>(), commands = new Map<string, any>(), calls: string[] = [], fake = fakeCodex();
  let activeMarkdownView: any = null, currentChatView: any = null, activePlugin: any = null, latestNotePicker: any = null;
  const vaultReads: string[] = [];
  const syntheticVault = join(testHome, 'SyntheticVault');
  await mkdir(join(syntheticVault, 'ResearchScope'), { recursive: true });
  await mkdir(join(syntheticVault, 'Elsewhere'), { recursive: true });
  await writeFile(join(syntheticVault, 'ResearchScope', 'Scoped.md'), '# Scoped synthetic note\n\nOnly this explicitly selected fixture may enter the draft.');
  await writeFile(join(syntheticVault, 'Elsewhere', 'Unlisted.md'), 'This note must never be listed or read.');
  let view: any, plugin: any, chatId = '', historyPath = '';
  let blockedRenameTarget = '';
  let signalRenameStarted!: () => void, releaseBlockedRename!: () => void;
  const renameStarted = new Promise<void>(resolve => { signalRenameStarted = resolve; });
  const renameGate = new Promise<void>(resolve => { releaseBlockedRename = resolve; });
  const proto = dom.window.HTMLElement.prototype as any;
  proto.empty = function() { this.replaceChildren(); };
  proto.addClass = function(cls: string) { this.classList.add(cls); };
  proto.setText = function(text: string) { this.textContent = text; };
  proto.createEl = function(tag: string, options: any = {}) {
    const el = doc.createElement(tag);
    if (options.cls) el.className = options.cls;
    if (options.text) el.textContent = options.text;
    if (options.type) (el as any).type = options.type;
    if (options.placeholder) (el as any).placeholder = options.placeholder;
    if (options.value !== undefined) (el as any).value = options.value;
    for (const [key, value] of Object.entries(options.attr || {})) el.setAttribute(key, String(value));
    this.appendChild(el); return el;
  };
  proto.createDiv = function(options: any = {}) { return this.createEl('div', options); };
  class MarkdownView {}
  class TFile { constructor(public path: string) {} }
  class FuzzySuggestModal {
    items: string[] = [];
    opened = false;
    constructor(_app: any) { latestNotePicker = this; }
    setPlaceholder(_placeholder: string) {}
    setInstructions(_instructions: any[]) {}
    getItems() { return this.items; }
    open() { this.opened = true; }
  }
  class Plugin {
    app = { workspace: {
      detachLeavesOfType() {},
      getActiveViewOfType: () => activeMarkdownView,
      getLeavesOfType: () => currentChatView ? [{ view: currentChatView }] : [],
      revealLeaf: async () => {},
    } };
    async loadData() { return null; }
    async saveData(data: any) { this.saved = data; }
    saved: any;
    addSettingTab() {}
    registerView(id: string, factory: any) { factories.set(id, factory); }
    addCommand(command: any) { calls.push(command.id); commands.set(command.id, command); }
  }
  class ItemView {
    app: any;
    contentEl = doc.createElement('div');
    constructor() { this.app = activePlugin?.app ?? { workspace: {} }; doc.querySelector('main')!.appendChild(this.contentEl); }
  }
  class PluginSettingTab { constructor() {} }
  const module = { exports: {} };
  try {
    runInNewContext(await readFile('dist/plugin/main.js', 'utf8'), {
      module, exports: module.exports, process, Buffer, AbortController, setTimeout, clearTimeout,
      prompt: () => 'Project review', confirm: () => true,
      require: (name: string) => {
        if (name === 'obsidian') return { Plugin, ItemView, PluginSettingTab, MarkdownView, FuzzySuggestModal, TFile, Notice: class { constructor(_message: string) {} }, MarkdownRenderer: {
          renderMarkdown: async (markdown: string, body: HTMLElement) => { body.textContent = markdown; },
        } };
        if (name === 'node:child_process') return { spawn: fake.spawn };
        if (name === 'node:os') return { ...require(name), homedir: () => testHome };
        if (name === 'node:fs/promises') {
          const fileSystem = require(name);
          return { ...fileSystem, rename: async (from: string, to: string) => {
            if (blockedRenameTarget && String(to) === blockedRenameTarget) {
              blockedRenameTarget = '';
              signalRenameStarted();
              await renameGate;
            }
            return fileSystem.rename(from, to);
          } };
        }
        return require(name);
      },
    });
    const Agent = (module.exports as any).default; plugin = new Agent(); activePlugin = plugin;
    await plugin.onload();
    plugin.settings.corpusFolder = 'ResearchScope';
    plugin.app.vault = {
      adapter: { getBasePath: () => syntheticVault },
      getAbstractFileByPath: (path: string) => path === 'ResearchScope/Scoped.md' ? new TFile(path) : null,
      cachedRead: async (file: TFile) => { vaultReads.push(file.path); return readFile(join(syntheticVault, file.path), 'utf8'); },
    };
    view = factories.get('aster-chat')({}); currentChatView = view;
    await view.onOpen();
    expect(fake.children).toHaveLength(0);
    expect(doc.body.textContent).toContain('Vault notes');
    const input = doc.querySelector('[aria-label="Message Aster"]') as HTMLTextAreaElement;
    expect(input).not.toBeNull();
    input.value = '/sum';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(doc.querySelector('.pga-chat-slash-menu')?.hasAttribute('hidden')).toBe(false);
    expect(doc.querySelector('.pga-chat-slash-option')?.textContent).toContain('/summarize');
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(input.value).toBe('Summarize the conversation so far in 3–5 concise bullet points.');
    expect(doc.querySelector('.pga-chat-slash-menu')?.hasAttribute('hidden')).toBe(true);
    (Array.from(doc.querySelectorAll('button')).find(button => button.textContent === '＋ Skill') as HTMLButtonElement).onclick?.(new dom.window.Event('click'));
    (doc.querySelector('[aria-label="Skill name"]') as HTMLInputElement).value = 'meeting-review';
    (doc.querySelector('[aria-label="Skill description"]') as HTMLInputElement).value = 'Review meeting decisions and owners.';
    (doc.querySelector('[aria-label="Skill instructions"]') as HTMLTextAreaElement).value = 'List decisions, owners, and unresolved questions.';
    await (Array.from(doc.querySelectorAll('button')).find(button => button.textContent === 'Save Skill') as HTMLButtonElement).onclick?.(new dom.window.Event('click'));
    expect(doc.body.textContent).toContain('Skills (1)');
    const skillInput = doc.querySelector('[aria-label="Message Aster"]') as HTMLTextAreaElement;
    skillInput.value = '/meeting-review';
    skillInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    const skillOption = Array.from(doc.querySelectorAll('.pga-chat-slash-option')).find(option => option.textContent?.includes('/meeting-review')) as HTMLButtonElement;
    expect(skillOption).toBeTruthy();
    skillOption.onclick?.(new dom.window.MouseEvent('click', { bubbles: true }));
    skillInput.value += 'Review this meeting.';
    expect(skillInput.value).toContain('List decisions, owners, and unresolved questions.');
    expect(skillInput.value).toContain('Request:\nReview this meeting.');
    expect(fake.children).toHaveLength(0);
    const newChat = Array.from(doc.querySelectorAll('button')).find(button => button.textContent?.includes('New chat')) as HTMLButtonElement;
    await newChat.onclick?.(new dom.window.Event('click'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(plugin.settings.chats).toHaveLength(1);
    expect(plugin.saved.chats[0]).not.toHaveProperty('messages');
    const rename = doc.querySelector('[aria-label="Rename New chat"]') as HTMLButtonElement;
    await rename.onclick?.(new dom.window.Event('click'));
    expect(plugin.settings.chats[0].title).toBe('Project review');
    const search = doc.querySelector('[aria-label="Search chat titles"]') as HTMLInputElement;
    search.value = 'project'; search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(doc.querySelectorAll('.pga-chat-list-item')).toHaveLength(1);
    search.value = 'missing'; search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(doc.querySelector('.pga-chat-list-empty')?.textContent).toContain('No chat titles match');
    expect(fake.children).toHaveLength(0);

    const composer = doc.querySelector('[aria-label="Message Aster"]') as HTMLTextAreaElement;
    composer.value = 'Please say hello.';
    (Array.from(doc.querySelectorAll('button')).find(button => button.textContent === 'Send') as HTMLButtonElement).onclick?.(new dom.window.Event('click'));
    const deadline = Date.now() + 5000;
    while (!doc.querySelector('.pga-chat-status')?.textContent?.startsWith('Response complete') && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(doc.querySelector('.pga-chat-status')?.textContent).toContain('Response complete');
    expect(doc.querySelector('.pga-chat-message-assistant .pga-chat-message-body')?.textContent).toContain('Aster stream');
    expect(doc.querySelector('.pga-context-meter')?.textContent).toContain('60% context used');
    expect(fake.children.some(child => child.args[0] === 'app-server')).toBe(true);
    expect(plugin.settings.chats[0].providerThreadId).toMatch(/^ui-thread-\d+$/);
    expect(plugin.saved.chats[0].providerThreadId).toBe(plugin.settings.chats[0].providerThreadId);
    chatId = plugin.settings.chats[0].id;
    historyPath = join(testHome, '.aster', 'chats', chatId + '.json');
    const saved = JSON.parse(await readFile(historyPath, 'utf8'));
    expect(saved.map((message: any) => message.role)).toEqual(['user', 'assistant']);
    await view.onClose();
    expect(fake.children.find(child => child.args[0] === 'app-server').exitCode).toBe(0);

    view = factories.get('aster-chat')({}); currentChatView = view;
    await view.onOpen();
    const followUp = doc.querySelector('[aria-label="Message Aster"]') as HTMLTextAreaElement;
    followUp.value = 'Follow up after reopening.';
    (Array.from(doc.querySelectorAll('button')).find(button => button.textContent === 'Send') as HTMLButtonElement).onclick?.(new dom.window.Event('click'));
    const resumeDeadline = Date.now() + 5000;
    while (!doc.querySelector('.pga-chat-status')?.textContent?.startsWith('Response complete') && Date.now() < resumeDeadline) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(doc.querySelector('.pga-chat-status')?.textContent).toContain('Response complete');
    const resumedServer = [...fake.children].reverse().find(child => child.args[0] === 'app-server');
    expect(resumedServer.requests.find((request: any) => request.method === 'thread/resume')?.params.threadId)
      .toBe(plugin.settings.chats[0].providerThreadId);
    expect(resumedServer.requests.find((request: any) => request.method === 'turn/start')?.params.input[0].text)
      .toBe('Follow up after reopening.');
    expect(JSON.parse(await readFile(historyPath, 'utf8')).map((message: any) => message.role))
      .toEqual(['user', 'assistant', 'user', 'assistant']);

    await view.onClose();
    const appServerCount = fake.children.filter(child => child.args[0] === 'app-server').length;
    view = factories.get('aster-chat')({}); currentChatView = view;
    await view.onOpen();
    let deleteStarted = false;
    const originalDeleteHistories = view.deleteHistories.bind(view);
    view.deleteHistories = async (chats: any[]) => {
      deleteStarted = true;
      return originalDeleteHistories(chats);
    };
    blockedRenameTarget = historyPath;
    const racingInput = doc.querySelector('[aria-label="Message Aster"]') as HTMLTextAreaElement;
    racingInput.value = 'This message races with Clear chats.';
    (Array.from(doc.querySelectorAll('button')).find(button => button.textContent === 'Send') as HTMLButtonElement).onclick?.(new dom.window.Event('click'));
    await renameStarted;

    const clearButton = Array.from(doc.querySelectorAll('button')).find(button => button.textContent === 'Clear chats') as HTMLButtonElement;
    const clearTask = clearButton.onclick?.(new dom.window.Event('click'));
    await Promise.resolve();
    expect(view.clearingChats).toBe(true);
    expect(deleteStarted).toBe(false);
    expect(plugin.settings.chats).toHaveLength(1);
    releaseBlockedRename();
    await clearTask;

    expect(deleteStarted).toBe(true);
    expect(plugin.settings.chats).toHaveLength(0);
    await expect(readFile(historyPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    expect(fake.children.filter(child => child.args[0] === 'app-server')).toHaveLength(appServerCount);

    activeMarkdownView = {
      editor: { getSelection: () => 'A selected passage for a visible, reviewable Quick Ask draft.' },
      file: { path: 'Research/Source.md' },
    };
    await commands.get('quick-ask-selection').callback();
    expect(plugin.settings.chats).toHaveLength(1);
    expect(plugin.settings.chats[0].title).toBe('Quick Ask · Source.md');
    const quickAskDraft = doc.querySelector('[aria-label="Message Aster"]') as HTMLTextAreaElement;
    expect(quickAskDraft.value).toContain('Source: Research/Source.md');
    expect(quickAskDraft.value).toContain('A selected passage for a visible, reviewable Quick Ask draft.');
    expect(doc.querySelector('.pga-chat-status')?.textContent).toContain('Review before sending.');

    activeMarkdownView = {
      editor: { getValue: () => '# Synthetic note\n\nA reversible test-only note body with no personal Vault data.' },
      file: { path: 'Synthetic/Active.md' },
    };
    const providerCountBeforeAttach = fake.children.length;
    await commands.get('attach-active-note').callback();
    const attachedDraft = doc.querySelector('[aria-label="Message Aster"]') as HTMLTextAreaElement;
    expect(attachedDraft.value).toContain('Note context: Synthetic/Active.md');
    expect(attachedDraft.value).toContain('A reversible test-only note body with no personal Vault data.');
    expect(doc.querySelector('.pga-chat-status')?.textContent).toContain('has not sent or changed the note');
    const draftBeforeOversize = attachedDraft.value;
    await expect(currentChatView.attachNoteToDraft('x'.repeat(24_001), 'Synthetic/Large.md')).rejects.toThrow('24,000 characters');
    expect(attachedDraft.value).toBe(draftBeforeOversize);
    expect(fake.children).toHaveLength(providerCountBeforeAttach);

    latestNotePicker = null;
    (doc.querySelector('[aria-label="Choose a note in the configured Corpus to preview as context"]') as HTMLButtonElement).onclick?.(new dom.window.Event('click'));
    const pickerDeadline = Date.now() + 3000;
    while (!latestNotePicker?.opened && Date.now() < pickerDeadline) await new Promise(resolve => setTimeout(resolve, 5));
    expect(latestNotePicker?.getItems()).toEqual(['Scoped.md']);
    expect(vaultReads).toEqual([]);
    latestNotePicker.onChooseItem('Scoped.md');
    const previewDeadline = Date.now() + 3000;
    while (!doc.querySelector('.pga-chat-context-preview') && Date.now() < previewDeadline) await new Promise(resolve => setTimeout(resolve, 5));
    const contextPreview = doc.querySelector('.pga-chat-context-preview') as HTMLElement;
    expect(contextPreview?.textContent).toContain('Only this explicitly selected fixture may enter the draft.');
    expect(vaultReads).toEqual(['ResearchScope/Scoped.md']);
    expect(fake.children).toHaveLength(providerCountBeforeAttach);
    const scopedDraft = doc.querySelector('[aria-label="Message Aster"]') as HTMLTextAreaElement;
    await (Array.from(contextPreview.querySelectorAll('button')).find(button => button.textContent === 'Add context to draft') as HTMLButtonElement).onclick?.(new dom.window.Event('click'));
    expect(doc.querySelector('.pga-chat-context-preview')).toBeNull();
    expect(scopedDraft.value).toContain('Note context: ResearchScope/Scoped.md');
    expect(scopedDraft.value).toContain('Only this explicitly selected fixture may enter the draft.');
    expect(fake.children).toHaveLength(providerCountBeforeAttach);

    const addProject = Array.from(doc.querySelectorAll('button')).find(button => button.textContent === '＋ Project') as HTMLButtonElement;
    await addProject.onclick?.(new dom.window.Event('click'));
    (doc.querySelector('[aria-label="Project name"]') as HTMLInputElement).value = 'Research';
    (doc.querySelector('[aria-label="Project instructions"]') as HTMLTextAreaElement).value = 'Use only primary sources.';
    await (Array.from(doc.querySelectorAll('button')).find(button => button.textContent === 'Save project') as HTMLButtonElement).onclick?.(new dom.window.Event('click'));
    expect(plugin.settings.projects).toHaveLength(1);
    expect(plugin.settings.projects[0]).toMatchObject({ name: 'Research', instructions: 'Use only primary sources.' });

    const newProjectChat = Array.from(doc.querySelectorAll('button')).find(button => button.textContent?.includes('New chat')) as HTMLButtonElement;
    newProjectChat.onclick?.(new dom.window.Event('click'));
    await new Promise(resolve => setTimeout(resolve, 0));
    const originalProjectChatId = plugin.settings.activeChatId;
    expect(plugin.settings.chats[0]).toMatchObject({ projectName: 'Research', projectInstructions: 'Use only primary sources.' });
    expect(doc.querySelector('.pga-chat-project-context')?.textContent).toContain('Project · Research');

    await (Array.from(doc.querySelectorAll('button')).find(button => button.textContent === 'Edit project') as HTMLButtonElement).onclick?.(new dom.window.Event('click'));
    (doc.querySelector('[aria-label="Project instructions"]') as HTMLTextAreaElement).value = 'Prefer cited comparisons.';
    await (Array.from(doc.querySelectorAll('button')).find(button => button.textContent === 'Save project') as HTMLButtonElement).onclick?.(new dom.window.Event('click'));
    expect(plugin.settings.chats.find((chat: any) => chat.id === originalProjectChatId)?.projectInstructions).toBe('Use only primary sources.');
    const nextProjectChat = Array.from(doc.querySelectorAll('button')).find(button => button.textContent?.includes('New chat')) as HTMLButtonElement;
    nextProjectChat.onclick?.(new dom.window.Event('click'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(plugin.settings.chats[0]).toMatchObject({ projectName: 'Research', projectInstructions: 'Prefer cited comparisons.' });
    expect(fake.children.filter(child => child.args[0] === 'app-server')).toHaveLength(appServerCount);
  } finally {
    releaseBlockedRename?.();
    await view?.onClose().catch(() => {});
    dom.window.close();
    const cleanupId = chatId || plugin?.settings?.chats?.[0]?.id;
    if (cleanupId) await unlink(join(testHome, '.aster', 'chats', cleanupId + '.json')).catch(() => {});
    await rmdir(join(testHome, '.aster', 'chats')).catch(() => {});
    await unlink(join(testHome, '.aster', 'skills', 'meeting-review', 'SKILL.md')).catch(() => {});
    await rmdir(join(testHome, '.aster', 'skills', 'meeting-review')).catch(() => {});
    await rmdir(join(testHome, '.aster', 'skills')).catch(() => {});
    await rmdir(join(testHome, '.aster')).catch(() => {});
    await unlink(join(syntheticVault, 'ResearchScope', 'Scoped.md')).catch(() => {});
    await unlink(join(syntheticVault, 'Elsewhere', 'Unlisted.md')).catch(() => {});
    await rmdir(join(syntheticVault, 'ResearchScope')).catch(() => {});
    await rmdir(join(syntheticVault, 'Elsewhere')).catch(() => {});
    await rmdir(syntheticVault).catch(() => {});
    await rmdir(testHome).catch(() => {});
  }
});
