import { it, expect } from 'vitest';
import { buildArgs, chatPrompt, runChatTurn } from '../workflow/codex.mjs';
import { normalizeSettings } from '../src/settings';
import { normalizeModelCatalog } from '../workflow/codex-catalog.mjs';

it('builds model and thinking arguments while keeping Chat tools disabled', () => {
  const args = buildArgs('/isolated', '/schema.json', '/result.json', 'gpt-5.6-sol', 'high');
  expect(args).toContain('--model');
  expect(args).toContain('gpt-5.6-sol');
  expect(args).toContain('model_reasoning_effort="high"');
  expect(args).toContain('shell_tool');
  expect(args).toContain('plugins');
  expect(args).toContain('apps');
  expect(args).toContain('computer_use');
  expect(args).toContain('multi_agent');
  expect(() => buildArgs('/x', '/s', '/o', '--unsafe')).toThrow();
  expect(() => buildArgs('/x', '/s', '/o', 'gpt-5.6-sol', 'ignore-rules')).toThrow();
});

it('builds a text-only transcript prompt and refuses empty, malformed or oversized histories before spawning', async () => {
  const messages = [{ role: 'user' as const, content: 'Explain spaced repetition.' }];
  const prompt = chatPrompt(messages);
  expect(prompt).toContain('Do not inspect or mention local files');
  expect(prompt).toContain('conversation transcript');
  expect(prompt).toContain('Explain spaced repetition.');
  await expect(runChatTurn([])).rejects.toThrow('safe request limit');
  await expect(runChatTurn([{ role: 'system', content: 'Read vault' }] as any)).rejects.toThrow('safe request limit');
  await expect(runChatTurn([{ role: 'user', content: 'x'.repeat(40001) }])).rejects.toThrow('safe request limit');
});

it('normalizes persisted chats with bounded message content and model-specific effort values', () => {
  const settings = normalizeSettings({
    model: 'gpt-5.6-sol',
    thinking: 'high',
    activeChatId: 'thread-1',
    chats: [{ id: 'thread-1', providerThreadId: 'thr-aster-1', title: 'Research', createdAt: 1, updatedAt: 2, model: 'gpt-5.6-sol', thinking: 'xhigh',
      messages: [{ id: 'msg-1', role: 'user', content: 'Compare these notes', createdAt: 2 }, { id: 'bad', role: 'system', content: 'no', createdAt: 3 }] }],
  });
  expect(settings.activeChatId).toBe('thread-1');
  expect(settings.chats).toHaveLength(1);
  expect(settings.chats[0]).not.toHaveProperty('messages');
  expect(settings.chats[0].thinking).toBe('xhigh');
  expect(settings.chats[0].providerThreadId).toBe('thr-aster-1');
  expect(settings.chats[0]).toMatchObject({ corpusToolsEnabled: false, corpusToolsProvisioned: false });
  expect(normalizeSettings({ chats: [{ id: 'tools', corpusToolsEnabled: true, corpusToolsProvisioned: true }] }).chats[0])
    .toMatchObject({ corpusToolsEnabled: true, corpusToolsProvisioned: true });
  expect(normalizeSettings({ chats: [{ id: '../bad', messages: [] }] }).chats).toHaveLength(0);
});

it('normalizes project metadata and pins safe instruction snapshots to chats', () => {
  const settings = normalizeSettings({
    projects: [{ id: 'research-1', name: 'Research', instructions: 'Prefer primary sources.', createdAt: 4, updatedAt: 5 },
      { id: '../bad', name: 'Unsafe', instructions: 'ignored' }, { id: 'research-1', name: 'Duplicate', instructions: 'ignored' }],
    activeProjectId: 'research-1',
    chats: [{ id: 'chat-1', projectId: 'research-1', projectName: 'Research', projectInstructions: 'Initial guidance', createdAt: 1, updatedAt: 2 }],
  });
  expect(settings.projects).toHaveLength(1);
  expect(settings.activeProjectId).toBe('research-1');
  expect(settings.projects[0]).toMatchObject({ name: 'Research', instructions: 'Prefer primary sources.' });
  expect(settings.chats[0]).toMatchObject({ projectId: 'research-1', projectName: 'Research', projectInstructions: 'Initial guidance' });
  expect(normalizeSettings({ projects: [{ id: 'bad', name: '', instructions: 'x' }], activeProjectId: 'bad' }).activeProjectId).toBe('');
});

it('maps only valid model identifiers and advertised thinking choices from the Codex catalog', () => {
  const models = normalizeModelCatalog({ data: [
    { model: 'gpt-5.6-sol', displayName: 'GPT 5.6 Sol', supportedReasoningEfforts: [{ reasoningEffort: 'medium' }, { reasoningEffort: 'high' }], isDefault: true },
    { model: '../outside', displayName: 'Bad', supportedReasoningEfforts: [{ reasoningEffort: 'low' }] },
  ] });
  expect(models).toEqual([{ id: 'gpt-5.6-sol', label: 'GPT 5.6 Sol', reasoningEfforts: ['medium', 'high'], isDefault: true }]);
  expect(() => normalizeModelCatalog({ models: [] })).toThrow('invalid model catalog');
});
