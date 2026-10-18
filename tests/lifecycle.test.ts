import { createRequire } from 'node:module';
import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
it('registers Chat and Knowledge Studio without scanning a vault or starting a model process', async () => {
  const commands: any[] = [], views: any[] = [];
  let spawned = 0;
  class Plugin {
    app = { workspace: { detachLeavesOfType: () => {} } };
    async loadData() { return null; }
    addSettingTab() {}
    registerView(...args: any[]) { views.push(args); }
    addCommand(command: any) { commands.push(command); }
  }
  class FuzzySuggestModal {}
  class TFile {}
  const module = { exports: {} };
  runInNewContext(await readFile('dist/plugin/main.js', 'utf8'), {
    module, exports: module.exports,
    require: (name: string) => {
      if (name !== 'obsidian' && !name.startsWith('node:')) throw new Error('Unexpected dependency ' + name);
      if (name.startsWith('node:')) {
        const actual = require(name);
        if (name === 'node:child_process') return { ...actual, spawn: (...args: any[]) => { spawned++; return actual.spawn(...args); } };
        return actual;
      }
      return { Plugin, ItemView: class {}, PluginSettingTab: class { constructor() {} }, MarkdownView: class {}, FuzzySuggestModal, TFile, Notice: class {}, MarkdownRenderer: { renderMarkdown: async () => {} } };
    },
  });
  const Agent = (module.exports as any).default, plugin = new Agent();
  await plugin.onload();
  expect(views.map(view => view[0])).toEqual(['knowledge-agent-workbench', 'aster-chat']);
  expect(commands.map(command => command.id)).toEqual(['open-workbench', 'open-chat', 'quick-ask-selection', 'attach-active-note']);
  expect(spawned).toBe(0);
  plugin.onunload();
});
