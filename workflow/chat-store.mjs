import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const MAX_MESSAGES = 80, MAX_MESSAGE_LENGTH = 40000, MAX_BYTES = 120000;
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;
const targetTails = new Map();
const deletedTargets = new Set();
export const defaultChatStoreRoot = () => join(homedir(), '.aster', 'chats');
function targetKey(path) { return resolve(path); }
async function withTargetLock(path, action) {
  const key = targetKey(path);
  const previous = targetTails.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  targetTails.set(key, current);
  await previous;
  try { return await action(key); }
  finally {
    release();
    if (targetTails.get(key) === current) targetTails.delete(key);
  }
}
async function directory(path, create) {
  try { const stat = await lstat(path); if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Aster Chat store path is not a plain local directory.'); return true; }
  catch (error) { if (error?.code !== 'ENOENT') throw error; if (!create) return false; await mkdir(path, { mode: 0o700 }); return true; }
}
async function ensureStore(root) { await directory(dirname(root), true); await directory(root, true); }
function targetPath(root, id) { if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new Error('Invalid Chat session ID.'); return join(root, id + '.json'); }
function validateHistory(messages) {
  if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) throw new Error('Chat history exceeded its safe storage limit.');
  const clean = messages.map(message => {
    if (!message || typeof message.id !== 'string' || !ID_PATTERN.test(message.id) || !['user', 'assistant'].includes(message.role)
      || typeof message.content !== 'string' || !message.content.trim() || message.content.length > MAX_MESSAGE_LENGTH
      || !Number.isFinite(Number(message.createdAt))) throw new Error('Chat history has an invalid message.');
    return { id: message.id, role: message.role, content: message.content, createdAt: Number(message.createdAt) };
  });
  if (Buffer.byteLength(JSON.stringify(clean), 'utf8') > MAX_BYTES) throw new Error('Chat history exceeded its 120KB storage limit.');
  return clean;
}
async function inspectTarget(path) {
  try { const stat = await lstat(path); if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Aster Chat history is not a plain local file.'); return stat; }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}
export async function loadChatHistory(root, id) {
  const path = targetPath(root, id);
  if (deletedTargets.has(targetKey(path))) return [];
  if (!await directory(dirname(root), false) || !await directory(root, false)) return [];
  const stat = await inspectTarget(path); if (!stat) return [];
  if (stat.size > MAX_BYTES) throw new Error('Aster Chat history file exceeds its storage limit.');
  let parsed; try { parsed = JSON.parse(await readFile(path, 'utf8')); } catch { throw new Error('Aster Chat history is unreadable or malformed.'); }
  return validateHistory(parsed);
}
export async function saveChatHistory(root, id, messages) {
  const path = targetPath(root, id), clean = validateHistory(messages);
  return withTargetLock(path, async key => {
    if (deletedTargets.has(key)) throw new Error('This Chat transcript was cleared and cannot be recreated.');
    await ensureStore(root); await inspectTarget(path);
    const temporary = join(root, '.aster-chat-' + randomUUID() + '.tmp');
    try { await writeFile(temporary, JSON.stringify(clean), { flag: 'wx', mode: 0o600 }); await rename(temporary, path); }
    finally { await unlink(temporary).catch(() => {}); }
  });
}
export async function deleteChatHistory(root, id) {
  const path = targetPath(root, id);
  return withTargetLock(path, async key => {
    if (deletedTargets.has(key)) return false;
    if (!await directory(dirname(root), false) || !await directory(root, false)) { deletedTargets.add(key); return false; }
    const stat = await inspectTarget(path);
    if (!stat) { deletedTargets.add(key); return false; }
    await unlink(path);
    deletedTargets.add(key);
    return true;
  });
}
