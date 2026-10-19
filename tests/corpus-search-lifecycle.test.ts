import { it, expect, vi } from 'vitest';
import type { App, EventRef } from 'obsidian';
import { registerCorpusSearchInvalidation } from '../src/corpus-search-lifecycle';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { invalidateCorpusSearchIndex, searchCorpus } from '../workflow/corpus.mjs';

it('waits for Obsidian layout readiness and invalidates on every Vault file lifecycle event', () => {
  let onLayoutReady: (() => void) | undefined;
  const listeners = new Map<string, () => void>();
  const registered: EventRef[] = [];
  const invalidate = vi.fn();
  const app = {
    workspace: { onLayoutReady: (callback: () => void) => { onLayoutReady = callback; } },
    vault: { on: (event: string, callback: () => void) => { listeners.set(event, callback); return { event } as EventRef; } },
  } as unknown as Pick<App, 'vault' | 'workspace'>;

  const stop = registerCorpusSearchInvalidation(app, eventRef => registered.push(eventRef), invalidate);
  expect(registered).toHaveLength(0);
  onLayoutReady?.();
  expect([...listeners.keys()]).toEqual(['create', 'modify', 'delete', 'rename']);
  expect(registered).toHaveLength(4);

  for (const event of listeners.values()) event();
  expect(invalidate).toHaveBeenCalledTimes(4);
  stop();
  for (const event of listeners.values()) event();
  expect(invalidate).toHaveBeenCalledTimes(4);
});

it('does not register Vault listeners if the plugin unloads before layout readiness', () => {
  let onLayoutReady: (() => void) | undefined;
  const registered: EventRef[] = [];
  const app = {
    workspace: { onLayoutReady: (callback: () => void) => { onLayoutReady = callback; } },
    vault: { on: () => ({}) },
  } as unknown as Pick<App, 'vault' | 'workspace'>;
  const stop = registerCorpusSearchInvalidation(app, eventRef => registered.push(eventRef));
  stop();
  onLayoutReady?.();
  expect(registered).toHaveLength(0);
});

it('rebuilds the local search index after an Obsidian modify event', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aster-search-lifecycle-'));
  const note = join(root, 'Note.md');
  await writeFile(note, '# Source\n\nNeedle evidence.\n');
  invalidateCorpusSearchIndex();
  let onLayoutReady: (() => void) | undefined;
  const listeners = new Map<string, () => void>();
  const app = {
    workspace: { onLayoutReady: (callback: () => void) => { onLayoutReady = callback; } },
    vault: { on: (event: string, callback: () => void) => { listeners.set(event, callback); return { event } as EventRef; } },
  } as unknown as Pick<App, 'vault' | 'workspace'>;
  const stop = registerCorpusSearchInvalidation(app, () => {});
  try {
    onLayoutReady?.();
    const cold = await searchCorpus(root, 'Needle');
    const warm = await searchCorpus(root, 'Needle');
    expect(cold.cacheHit).toBe(false);
    expect(warm.cacheHit).toBe(true);

    await writeFile(note, '# Source\n\nCandle evidence.\n');
    listeners.get('modify')?.();
    const refreshed = await searchCorpus(root, 'Needle');
    expect(refreshed.cacheHit).toBe(false);
    expect(refreshed.results).toHaveLength(0);
  } finally {
    stop();invalidateCorpusSearchIndex();await rm(root, { recursive: true, force: true });
  }
});
