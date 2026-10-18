import { expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const race = vi.hoisted(() => ({
  destination: '',
  blockNextRename: null as null | (() => Promise<void>),
}));

vi.mock('node:fs/promises', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...fs,
    rename: async (from: string, to: string) => {
      if (race.blockNextRename && String(to) === race.destination) {
        const block = race.blockNextRename;
        race.blockNextRename = null;
        await block();
      }
      return fs.rename(from, to);
    },
  };
});

import { deleteChatHistory, loadChatHistory, saveChatHistory } from '../workflow/chat-store.mjs';

it('serializes Clear behind an in-flight transcript rename and rejects a late stale save', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'aster-chat-store-race-'));
  const root = join(temporaryRoot, 'chats');
  const id = 'thread-clear-race';
  const destination = join(root, id + '.json');
  const initial = [{ id: 'message-1', role: 'user' as const, content: 'Before Clear', createdAt: 1 }];
  const racing = [{ id: 'message-2', role: 'user' as const, content: 'Send racing with Clear', createdAt: 2 }];
  await saveChatHistory(root, id, initial);

  let announceRename!: () => void;
  let releaseRename!: () => void;
  const renameStarted = new Promise<void>(resolve => { announceRename = resolve; });
  const renameGate = new Promise<void>(resolve => { releaseRename = resolve; });
  race.destination = destination;
  race.blockNextRename = async () => { announceRename(); await renameGate; };
  let saving: Promise<void> | undefined;
  let clearing: Promise<boolean> | undefined;

  try {
    saving = saveChatHistory(root, id, racing);
    await renameStarted;
    let clearFinished = false;
    clearing = deleteChatHistory(root, id).then(result => { clearFinished = true; return result; });
    await Promise.resolve();
    expect(clearFinished).toBe(false);

    releaseRename();
    await saving;
    expect(await clearing).toBe(true);
    await expect(readFile(destination, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await loadChatHistory(root, id)).toEqual([]);
    await expect(saveChatHistory(root, id, racing)).rejects.toThrow('was cleared');
  } finally {
    releaseRename();
    race.destination = '';
    race.blockNextRename = null;
    await Promise.allSettled([saving, clearing].filter((operation): operation is Promise<unknown> => !!operation));
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
