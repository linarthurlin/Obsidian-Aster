import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { runInNewContext } from 'node:vm';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

it('reviews, applies and rolls back only the individually approved target in a multi-note proposal', async () => {
  const home = await mkdtemp(join(tmpdir(), 'aster-workbench-batch-'));
  const corpus = join(home, 'Selected');
  await mkdir(corpus);
  const beforeOne = '# One\nExisting first note.\n';
  const beforeTwo = '# Two\nExisting second note.\n';
  await writeFile(join(corpus, 'One.md'), beforeOne);
  await writeFile(join(corpus, 'Two.md'), beforeTwo);
  await writeFile(join(corpus, 'Evidence.md'), '# Evidence\nSynthetic evidence for neural plasticity and learning.\n');
  const dom = new JSDOM('<main></main>');
  const doc = dom.window.document;
  const factories = new Map<string, any>();
  const proto = dom.window.HTMLElement.prototype as any;
  proto.empty = function() { this.replaceChildren(); };
  proto.addClass = function(cls: string) { this.classList.add(cls); };
  proto.setText = function(text: string) { this.textContent = text; };
  proto.createEl = function(tag: string, options: any = {}) {
    const element = doc.createElement(tag);
    if (options.cls) element.className = options.cls;
    if (options.text) element.textContent = options.text;
    if (options.type) (element as any).type = options.type;
    if (options.placeholder) (element as any).placeholder = options.placeholder;
    if (options.value !== undefined) (element as any).value = options.value;
    for (const [key, value] of Object.entries(options.attr || {})) element.setAttribute(key, String(value));
    this.appendChild(element);
    return element;
  };
  proto.createDiv = function(options: any = {}) { return this.createEl('div', options); };
  proto.createSpan = function(options: any = {}) { return this.createEl('span', options); };

  const app = { vault: { adapter: { getBasePath: () => home } }, workspace: { detachLeavesOfType: () => {} } };
  class Plugin {
    app = app;
    async loadData() { return { corpusFolder: 'Selected', executable: process.execPath }; }
    registerView(id: string, factory: (leaf: unknown) => unknown) { factories.set(id, factory); }
    addCommand() {}
    addSettingTab() {}
  }
  class ItemView {
    app = app;
    contentEl = doc.createElement('div');
    constructor() { doc.querySelector('main')!.appendChild(this.contentEl); }
    registerDomEvent(element: HTMLElement, event: string, handler: EventListener) { element.addEventListener(event, handler); }
  }
  class FuzzySuggestModal {}
  class TFile {}
  class TFolder {}
  const module = { exports: {} as any };
  const spawn = (_executable: string, args: string[]) => {
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; stdin: Writable; kill(): void };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => child.emit('close', 1);
    let input = '';
    child.stdin = new Writable({
      write(chunk, _encoding, callback) { input += chunk.toString(); callback(); },
      final(callback) {
        const marker = 'CONTEXT_JSON\n';
        const context = JSON.parse(input.slice(input.lastIndexOf(marker) + marker.length));
        const outputPath = args[args.indexOf('--output-last-message') + 1];
        const result = {
          status: 'proposal',
          reason: 'Synthetic evidence supports two separate updates.',
          operations: context.targets.map((target: { path: string; text: string }) => ({
            path: target.path,
            reason: 'Add one evidence-backed detail.',
            after: target.text + `Evidence-backed detail for ${target.path}.\n`,
            sources: [{ path: context.sources[0].path, excerpt: context.sources[0].excerpt.slice(0, 32) }],
          })),
        };
        void writeFile(outputPath, JSON.stringify(result)).then(() => {
          callback();
          child.emit('close', 0);
        }, error => {
          callback(error as Error);
          child.emit('error', error);
        });
      },
    });
    return child;
  };
  runInNewContext(await readFile('dist/plugin/main.js', 'utf8'), {
    module, exports: module.exports, process, Buffer, AbortController, setTimeout, clearTimeout, document: doc,
    require: (name: string) => name === 'obsidian'
      ? { Plugin, ItemView, PluginSettingTab: class {}, Setting: class {}, FuzzySuggestModal, TFile, TFolder }
      : name === 'node:child_process' ? { spawn }
      : name === 'node:os' ? { ...require('node:os'), homedir: () => home }
      : require(name),
  });
  const Agent = module.exports.default;
  const plugin = new Agent();
  try {
    await plugin.onload();
    const view = factories.get('knowledge-agent-workbench')({});
    await view.onOpen();
    const button = (label: string) => Array.from(doc.querySelectorAll('button')).find(element => element.textContent!.includes(label))!;
    const invoke = async (element: any) => { await element.onclick?.(new dom.window.Event('click')); };
    await invoke(button('Load scoped notes'));
    const targets = doc.querySelector('select') as HTMLSelectElement;
    for (const path of ['One.md', 'Two.md']) {
      const option = Array.from(targets.options).find(item => item.value === path)!;
      option.selected = true;
    }
    targets.dispatchEvent(new dom.window.Event('change'));
    const query = doc.querySelector('input[type=text]') as HTMLInputElement;
    query.value = 'neural plasticity';
    query.dispatchEvent(new dom.window.Event('input'));
    await invoke(button('Preview context'));
    expect(doc.querySelector('.pga-context')?.textContent).toContain('Existing first note.');
    expect(doc.querySelector('.pga-context')?.textContent).toContain('Existing second note.');

    const consent = doc.querySelector('.pga-consent input[type=checkbox]') as HTMLInputElement;
    consent.checked = true;
    consent.dispatchEvent(new dom.window.Event('change'));
    await invoke(button('Ask Codex'));
    const cards = Array.from(doc.querySelectorAll('.pga-proposal-change')) as HTMLElement[];
    expect(cards, doc.body.textContent || 'no rendered UI').toHaveLength(2);
    const firstCheckbox = cards[0].querySelector('input[type=checkbox]') as HTMLInputElement;
    const firstButtons = cards[0].querySelectorAll('button');
    firstCheckbox.checked = true;
    firstCheckbox.dispatchEvent(new dom.window.Event('change'));
    (firstButtons[0] as HTMLButtonElement).click();
    const waitFor = async (text: string) => {
      for (let i = 0; i < 100 && !cards[0].textContent?.includes(text); i++) await new Promise(resolve => setTimeout(resolve, 5));
      expect(cards[0].textContent).toContain(text);
    };
    await waitFor('Applied.');
    expect(await readFile(join(corpus, 'One.md'), 'utf8')).toContain('Evidence-backed detail for One.md.');
    expect(await readFile(join(corpus, 'Two.md'), 'utf8')).toBe(beforeTwo);
    expect((cards[1].querySelector('input[type=checkbox]') as HTMLInputElement).checked).toBe(false);

    (firstButtons[1] as HTMLButtonElement).click();
    await waitFor('Rolled back.');
    expect(await readFile(join(corpus, 'One.md'), 'utf8')).toBe(beforeOne);
    expect(await readFile(join(corpus, 'Two.md'), 'utf8')).toBe(beforeTwo);
    await view.onClose();
  } finally {
    await rm(home, { recursive: true, force: true });
    dom.window.close();
  }
});
