import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CHAT_CORPUS_TOOLS, dispatchChatCorpusTool } from '../workflow/chat-tools.mjs';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'aster-chat-tools-'));
  roots.push(root);
  await mkdir(join(root, 'Research'));
  await writeFile(join(root, 'Research', 'Glass.md'), '# Glass\nChampagne glass notes.');
  return root;
}

it('exposes only strict read-only search and single-note tools', () => {
  expect(CHAT_CORPUS_TOOLS.map(tool => tool.name)).toEqual(['aster_search_corpus', 'aster_read_corpus_note']);
  expect(CHAT_CORPUS_TOOLS.every(tool => tool.strict && tool.inputSchema.additionalProperties === false)).toBe(true);
});

it('searches the supplied Corpus and reads a selected note without accepting path escapes', async () => {
  const root = await fixture();
  const search = JSON.parse(await dispatchChatCorpusTool(root, 'aster_search_corpus', { query: 'champagne' }));
  expect(search.results[0]).toMatchObject({ path: 'Research/Glass.md', startLine: 1 });
  const note = await dispatchChatCorpusTool(root, 'aster_read_corpus_note', { path: 'Research/Glass.md' });
  expect(note).toContain('Champagne glass notes.');
  await expect(dispatchChatCorpusTool(root, 'aster_read_corpus_note', { path: '../private.md' })).rejects.toThrow('visible Markdown path');
  await expect(dispatchChatCorpusTool(root, 'aster_search_corpus', { query: 'glass', vault: true })).rejects.toThrow('allowed schema');
  await expect(dispatchChatCorpusTool(root, 'unknown', {})).rejects.toThrow('unknown Corpus tool');
});

it('rejects an oversized note instead of truncating it', async () => {
  const root = await fixture();
  await writeFile(join(root, 'Large.md'), 'x'.repeat(24001));
  await expect(dispatchChatCorpusTool(root, 'aster_read_corpus_note', { path: 'Large.md' })).rejects.toThrow('does not truncate');
});
