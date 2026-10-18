import { it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deleteChatHistory, loadChatHistory, saveChatHistory } from '../workflow/chat-store.mjs';

it('stores bounded chat transcripts atomically outside plugin settings and removes a selected session only', async () => {
  const root = join(await mkdtemp(join(tmpdir(), 'aster-chat-store-')), 'private', 'chats');
  const history = [{ id: 'message-1', role: 'user' as const, content: 'Private test text', createdAt: 1 }];
  await saveChatHistory(root, 'thread-1', history);
  expect(await loadChatHistory(root, 'thread-1')).toEqual(history);
  await saveChatHistory(root, 'thread-1', [...history, { id: 'message-2', role: 'assistant' as const, content: 'Aster reply', createdAt: 2 }]);
  expect(await loadChatHistory(root, 'thread-1')).toHaveLength(2);
  expect(await deleteChatHistory(root, 'thread-1')).toBe(true);
  expect(await loadChatHistory(root, 'thread-1')).toEqual([]);
  expect(await deleteChatHistory(root, 'thread-1')).toBe(false);
});

it('rejects traversal IDs, invalid message roles and oversized history', async () => {
  const root = join(await mkdtemp(join(tmpdir(), 'aster-chat-store-')), 'chats');
  await expect(loadChatHistory(root, '../private')).rejects.toThrow('Invalid Chat session ID');
  await expect(saveChatHistory(root, 'thread-1', [{ id: 'm-1', role: 'system', content: 'no', createdAt: 1 }] as any)).rejects.toThrow('invalid message');
  await expect(saveChatHistory(root, 'thread-1', [{ id: 'm-1', role: 'user', content: 'x'.repeat(40001), createdAt: 1 }] as any)).rejects.toThrow('invalid message');
});
