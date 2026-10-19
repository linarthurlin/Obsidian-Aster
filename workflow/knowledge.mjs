// Offline proposal/review engine. No model, network calls, automatic classification or background writes.
import { readFile, writeFile, lstat, realpath, rename, unlink, mkdir, stat, open, readdir } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join, dirname, basename, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
export const hash = text => createHash('sha256').update(text).digest('hex');
export async function safePath(rootPath, path, mustExist = true) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.includes(':') || /[\u0000-\u001f\u007f]/.test(path) || isAbsolute(path)
    || path.split('/').some(part => !part || part === '..' || part === '.' || part.startsWith('.')))
    throw new Error('Only visible, vault-relative paths are accepted');
  const root = await realpath(rootPath);
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Path escapes vault');
  let cursor = root;
  for (const part of path.split('/')) {
    cursor = join(cursor, part);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) throw new Error('Symlinks/junctions are not accepted');
      if (cursor === absolute && !info.isFile()) throw new Error('Expected a regular file');
    } catch (error) { if (error.code !== 'ENOENT' || mustExist || cursor !== absolute) throw error; }
  }
  return absolute;
}
export async function search(root, query, limit = 10) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink() || ['node_modules', '__pycache__'].includes(entry.name)) continue;
      const file = join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith('.md')) {
        const path = relative(root, file).replaceAll('\\', '/');
        const info = await stat(file);
        if (info.size > 2_000_000) continue;
        const text = await readFile(await safePath(root, path), 'utf8');
        const normalized = text.toLowerCase();
        const score = tokens.reduce((sum, token) => sum + (path.toLowerCase().includes(token) ? 5 : normalized.includes(token) ? 1 : 0), 0);
        if (score) hits.push({ path, score, hash: hash(text) });
      }
    }
  }
  root = await realpath(root); await walk(root);
  return hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit);
}
export async function propose(root, operations) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 50) throw new Error('Provide 1–50 proposed updates');
  const expanded = [];
  for (const operation of operations) {
    if (typeof operation.path !== 'string' || !operation.path.endsWith('.md') || typeof operation.after !== 'string'
      || operation.after.length > 2_000_000 || typeof operation.reason !== 'string' || !operation.reason.trim()) throw new Error('Invalid update');
    const before = await readFile(await safePath(root, operation.path), 'utf8');
    if (!Array.isArray(operation.sources) || !operation.sources.length) throw new Error('Every update needs source provenance');
    const sources = [];
    for (const source of operation.sources) {
      const text = await readFile(await safePath(root, source.path), 'utf8');
      if (typeof source.excerpt !== 'string' || !source.excerpt.trim() || !text.includes(source.excerpt)) throw new Error('Source excerpt not found');
      sources.push({ path: source.path, hash: hash(text), excerpt: source.excerpt, locator: source.locator || '' });
    }
    const related = await search(root, operation.path.split('/').pop().replace(/\.md$/, '').replace(/[-_]/g, ' '));
    expanded.push({ path: operation.path, before, beforeHash: hash(before), after: operation.after, afterHash: hash(operation.after),
      reason: operation.reason, sources, related });
  }
  if (new Set(expanded.map(op => op.path)).size !== expanded.length) throw new Error('Duplicate target paths');
  return { schema: 1, id: randomUUID(), createdAt: new Date().toISOString(), operations: expanded };
}
export function diff(path, before, after) {
  if (before === after) return `No changes: ${path}\n`;
  const a = before.split('\n'), b = after.split('\n');
  let start = 0, suffix = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  while (suffix < a.length - start && suffix < b.length - start && a[a.length - suffix - 1] === b[b.length - suffix - 1]) suffix++;
  const contextStart = Math.max(0, start - 3), contextEnd = Math.min(3, suffix);
  const lines = [...a.slice(contextStart, start).map(line => ' ' + line),
    ...a.slice(start, a.length - suffix).map(line => '-' + line),
    ...b.slice(start, b.length - suffix).map(line => '+' + line),
    ...a.slice(a.length - suffix, a.length - suffix + contextEnd).map(line => ' ' + line)];
  return `--- a/${path}\n+++ b/${path}\n@@ -${contextStart + 1},${a.length - suffix + contextEnd - contextStart} +${contextStart + 1},${b.length - suffix + contextEnd - contextStart} @@\n${lines.join('\n')}\n`;
}
function validateShape(plan) {
  if (!plan || plan.schema !== 1 || typeof plan.id !== 'string' || !Array.isArray(plan.operations)
    || !plan.operations.length || plan.operations.length > 50) throw new Error('Invalid plan schema');
  if (new Set(plan.operations.map(op => op.path)).size !== plan.operations.length) throw new Error('Duplicate targets');
  for (const op of plan.operations) {
    if (typeof op.path !== 'string' || !op.path.endsWith('.md') || typeof op.before !== 'string' || typeof op.after !== 'string'
      || op.before.length > 2_000_000 || op.after.length > 2_000_000 || op.beforeHash !== hash(op.before) || op.afterHash !== hash(op.after)
      || typeof op.reason !== 'string' || !op.reason.trim() || !Array.isArray(op.sources) || !op.sources.length) throw new Error('Corrupt operation');
    for (const source of op.sources) if (typeof source.path !== 'string' || typeof source.hash !== 'string'
      || typeof source.excerpt !== 'string' || !source.excerpt.trim()) throw new Error('Corrupt provenance');
  }
}
export function review(plan) {
  validateShape(plan);
  return { digest: hash(JSON.stringify(plan)), changes: plan.operations.map(op => ({ path: op.path, reason: op.reason,
    sources: op.sources, related: op.related || [], diff: diff(op.path, op.before, op.after) })) };
}
async function preflight(root, plan, rollback = false) {
  validateShape(plan);
  const paths = [];
  for (const op of plan.operations) {
    const absolute = await safePath(root, op.path);
    const text = await readFile(absolute, 'utf8');
    if (hash(text) !== (rollback ? op.afterHash : op.beforeHash)) throw new Error(`Content changed since ${rollback ? 'apply' : 'proposal'}: ${op.path}`);
    if (!rollback) for (const source of op.sources) {
      const text = await readFile(await safePath(root, source.path), 'utf8');
      if (hash(text) !== source.hash || !text.includes(source.excerpt)) throw new Error(`Source changed: ${source.path}`);
    }
    paths.push(absolute);
  }
  return paths;
}
async function atomicWrite(path, text) {
  const temp = join(dirname(path), `.aster-transaction-${randomUUID()}.tmp`);
  const mode = (await stat(path)).mode;
  try { await writeFile(temp, text, { flag: 'wx', mode }); await rename(temp, path); }
  finally { try { await unlink(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
}
const journalLocks = new Map();
function isOutside(root, path) {
  const rel = relative(root, path);
  return rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel);
}
async function withJournalLock(path, action) {
  const previous = journalLocks.get(path) || Promise.resolve();
  let release;
  const current = new Promise(resolveLock => { release = resolveLock; });
  journalLocks.set(path, current);
  await previous;
  try { return await action(); }
  finally {
    release();
    if (journalLocks.get(path) === current) journalLocks.delete(path);
  }
}
async function replaceJournal(path, transaction) {
  const temp = join(dirname(path), '.aster-transaction-' + randomUUID() + '.tmp');
  let handle;
  try {
    handle = await open(temp, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(transaction, null, 2));
    await handle.sync();
    await handle.close();
    handle = undefined;
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile()) throw new Error('Transaction journal must remain a regular file');
    await rename(temp, path);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await unlink(temp).catch(() => {});
  }
}
async function resolveJournal(rootPath, journalPath) {
  const root = await realpath(rootPath);
  let path = resolve(journalPath);
  if (!isOutside(root, path)) throw new Error('Transaction history must be outside the vault');
  path = join(await realpath(dirname(path)), basename(path));
  if (!isOutside(root, path)) throw new Error('Transaction history must resolve outside the vault');
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error('Transaction journal must be a regular file');
  if (info.size > 250_000_000) throw new Error('Transaction journal exceeds the safe read limit');
  let transaction;
  try { transaction = JSON.parse(await readFile(path, 'utf8')); }
  catch { throw new Error('Transaction journal is unreadable or malformed'); }
  if (!transaction || !['pending', 'applied', 'recovery-required', 'recovering', 'rolled-back', 'aborted'].includes(transaction.status)
    || transaction.root !== root || typeof transaction.digest !== 'string' || !transaction.plan
    || review(transaction.plan).digest !== transaction.digest)
    throw new Error('Transaction journal does not match this vault or its plan');
  if (transaction.recovery !== undefined) {
    const recovery = transaction.recovery;
    const paths = new Set(transaction.plan.operations.map(op => op.path));
    if (!recovery || typeof recovery !== 'object' || recovery.action !== 'rollback'
      || !Array.isArray(recovery.restored) || recovery.restored.length > transaction.plan.operations.length
      || recovery.restored.some(path => typeof path !== 'string' || !paths.has(path))
      || (recovery.conflicts !== undefined && (!Array.isArray(recovery.conflicts)
        || recovery.conflicts.some(path => typeof path !== 'string' || !paths.has(path)))))
      throw new Error('Transaction journal recovery metadata is invalid');
  }
  return { root, path, transaction };
}
async function inspectTargets(root, plan) {
  const targets = [];
  for (const op of plan.operations) {
    let absolute;
    try { absolute = await safePath(root, op.path, false); }
    catch (error) {
      if (error?.code === 'ENOENT') { targets.push({ path: op.path, state: 'missing' }); continue; }
      throw error;
    }
    try {
      const info = await lstat(absolute);
      if (info.isSymbolicLink() || !info.isFile()) { targets.push({ path: op.path, state: 'conflict' }); continue; }
      const currentHash = hash(await readFile(absolute, 'utf8'));
      targets.push({ path: op.path, state: currentHash === op.beforeHash ? 'before' : currentHash === op.afterHash ? 'after' : 'conflict' });
    } catch (error) {
      if (error?.code === 'ENOENT') targets.push({ path: op.path, state: 'missing' });
      else throw error;
    }
  }
  return targets;
}
export async function inspectTransactionJournal(root, journalPath) {
  const journal = await resolveJournal(root, journalPath);
  const savedRecovery = journal.transaction.recovery;
  return {
    status: journal.transaction.status,
    digest: journal.transaction.digest,
    planId: journal.transaction.plan.id,
    createdAt: journal.transaction.plan.createdAt,
    targets: await inspectTargets(journal.root, journal.transaction.plan),
    recovery: savedRecovery && {
      action: savedRecovery.action,
      startedAt: savedRecovery.startedAt,
      updatedAt: savedRecovery.updatedAt,
      completedAt: savedRecovery.completedAt,
      restoredCount: Array.isArray(savedRecovery.restored) ? savedRecovery.restored.length : 0,
      conflicts: Array.isArray(savedRecovery.conflicts) ? savedRecovery.conflicts : [],
    },
  };
}
export async function listTransactionJournals(rootPath, journalDirectory, limit = 50) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Transaction history limit must be between 1 and 100');
  const root = await realpath(rootPath);
  let directory = resolve(journalDirectory);
  if (!isOutside(root, directory)) throw new Error('Transaction history must be outside the vault');
  try { directory = await realpath(directory); }
  catch (error) { if (error?.code === 'ENOENT') return { items: [], skipped: 0 }; throw error; }
  if (!isOutside(root, directory)) throw new Error('Transaction history must resolve outside the vault');
  const directoryInfo = await lstat(directory);
  if (directoryInfo.isSymbolicLink() || !directoryInfo.isDirectory()) throw new Error('Transaction history path must be a plain local directory');
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.private.json')) continue;
    const path = join(directory, entry.name);
    try {
      const info = await lstat(path);
      if (info.isSymbolicLink() || !info.isFile()) continue;
      files.push({ path, modifiedAt: info.mtimeMs });
    } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
  files.sort((a, b) => b.modifiedAt - a.modifiedAt || a.path.localeCompare(b.path));
  let skipped = Math.max(0, files.length - 500);
  const items = [];
  for (const file of files.slice(0, 500)) {
    try {
      const journal = await resolveJournal(root, file.path);
      items.push({
        path: journal.path,
        status: journal.transaction.status,
        planId: journal.transaction.plan.id,
        createdAt: journal.transaction.plan.createdAt,
        targetPaths: journal.transaction.plan.operations.map(op => op.path),
      });
    } catch { skipped++; }
  }
  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || a.path.localeCompare(b.path));
  return { items: items.slice(0, limit), skipped: skipped + Math.max(0, items.length - limit) };
}
export async function readTransactionReview(root, journalPath) {
  const journal = await resolveJournal(root, journalPath);
  return {
    status: journal.transaction.status,
    digest: journal.transaction.digest,
    planId: journal.transaction.plan.id,
    createdAt: journal.transaction.plan.createdAt,
    changes: review(journal.transaction.plan).changes,
    targets: await inspectTargets(journal.root, journal.transaction.plan),
  };
}
async function restoreJournal(root, journalPath, allowedStatuses) {
  const initial = await resolveJournal(root, journalPath);
  return withJournalLock(initial.path, async () => {
    const journal = await resolveJournal(initial.root, initial.path);
    const transaction = journal.transaction;
    if (!allowedStatuses.includes(transaction.status)) throw new Error('Transaction journal is not in a recoverable state');
    const states = await inspectTargets(journal.root, transaction.plan);
    const conflicts = states.filter(target => target.state === 'conflict' || target.state === 'missing').map(target => target.path);
    if (conflicts.length) throw new Error('Recovery stopped before writing because targets are missing or contain later edits: ' + conflicts.join(', '));

    const startedAt = transaction.recovery?.startedAt || new Date().toISOString();
    const next = {
      ...transaction,
      status: 'recovering',
      recovery: { action: 'rollback', startedAt, updatedAt: new Date().toISOString(), restored: transaction.recovery?.restored || [] },
    };
    await replaceJournal(journal.path, next);
    let restored = 0;
    let alreadyBefore = 0;
    try {
      for (let index = 0; index < transaction.plan.operations.length; index++) {
        const op = transaction.plan.operations[index];
        if (states[index].state === 'before') { alreadyBefore++; continue; }
        const absolute = await safePath(journal.root, op.path);
        if (hash(await readFile(absolute, 'utf8')) !== op.afterHash) throw new Error('Concurrent edit during recovery: ' + op.path);
        await atomicWrite(absolute, op.before);
        restored++;
        next.recovery = {
          ...next.recovery,
          updatedAt: new Date().toISOString(),
          restored: [...next.recovery.restored, op.path],
        };
        await replaceJournal(journal.path, next);
      }
      const finalStates = await inspectTargets(journal.root, transaction.plan);
      const unfinished = finalStates.filter(target => target.state !== 'before').map(target => target.path);
      if (unfinished.length) throw new Error('Recovery did not restore every target to its reviewed before-state: ' + unfinished.join(', '));
      next.status = 'rolled-back';
      next.recovery = { ...next.recovery, completedAt: new Date().toISOString() };
      await replaceJournal(journal.path, next);
      return { status: 'rolled-back', restored, alreadyBefore };
    } catch (error) {
      try {
        const afterFailure = await inspectTargets(journal.root, transaction.plan);
        const changed = afterFailure.filter(target => target.state === 'conflict' || target.state === 'missing').map(target => target.path);
        if (changed.length) next.status = 'recovery-required';
        next.recovery = { ...next.recovery, updatedAt: new Date().toISOString(), conflicts: changed };
        await replaceJournal(journal.path, next);
      } catch { /* Keep the last valid journal state; recovery can be inspected and retried. */ }
      throw error;
    }
  });
}
export async function recoverTransactionJournal(root, journalPath) {
  return restoreJournal(root, journalPath, ['pending', 'recovery-required', 'recovering']);
}
export async function rollbackTransactionJournal(root, journalPath) {
  return restoreJournal(root, journalPath, ['applied', 'recovering']);
}
export async function apply(root, plan, digest, transactionPath) {
  if (review(plan).digest !== digest) throw new Error('Review digest does not match this exact plan');
  root = await realpath(root);
  // Keep transaction history outside the vault; never overwrite notes with a receipt.
  let receipt = resolve(transactionPath);
  if (!isOutside(root, receipt)) throw new Error('Transaction history must be outside the vault');
  await mkdir(dirname(receipt), { recursive: true });
  receipt = join(await realpath(dirname(receipt)), basename(receipt));
  if (!isOutside(root, receipt)) throw new Error('Transaction history must resolve outside the vault');
  let log = await open(receipt, 'wx', 0o600);
  const changed = [];
  try {
    const paths = await preflight(root, plan);
    // Write a recovery journal before the first mutation, then mark successful completion.
    await log.writeFile(JSON.stringify({ status: 'pending', root, digest, plan }, null, 2));
    await log.sync();
    await log.close();
    log = undefined;
    for (let index = 0; index < plan.operations.length; index++) {
      const op = plan.operations[index];
      if (hash(await readFile(await safePath(root, op.path), 'utf8')) !== op.beforeHash) throw new Error(`Concurrent edit: ${op.path}`);
      await atomicWrite(paths[index], op.after); changed.push(index);
    }
    await replaceJournal(receipt, { status: 'applied', root, digest, plan });
    return { status: 'applied', updated: changed.length };
  } catch (error) {
    if (log) { await log.close().catch(() => {}); log = undefined; }
    // Do not overwrite an external edit made after our own write.
    const conflicts = [];
    for (const index of changed.reverse()) {
      const op = plan.operations[index];
      try {
        const path = await safePath(root, op.path);
        if (hash(await readFile(path, 'utf8')) === op.afterHash) await atomicWrite(path, op.before); else conflicts.push(op.path);
      } catch { conflicts.push(op.path); }
    }
    try { await replaceJournal(receipt, { status: conflicts.length ? 'recovery-required' : 'aborted', root, digest, plan, conflicts }); }
    catch { /* The pending journal remains available for explicit recovery. */ }
    throw error;
  } finally { if (log) await log.close().catch(() => {}); }
}
export async function rollback(root, transaction) {
  const actualRoot = await realpath(root);
  if (transaction.status !== 'applied' || transaction.root !== actualRoot || transaction.digest !== review(transaction.plan).digest)
    throw new Error('Transaction does not match this vault or plan');
  const paths = await preflight(actualRoot, transaction.plan, true);
  const restored = [];
  try {
    for (let index = 0; index < paths.length; index++) {
      const op = transaction.plan.operations[index];
      if (hash(await readFile(await safePath(actualRoot, op.path), 'utf8')) !== op.afterHash) throw new Error(`Concurrent edit: ${op.path}`);
      await atomicWrite(paths[index], op.before); restored.push(index);
    }
  } catch (error) {
    for (const index of restored.reverse()) {
      const op = transaction.plan.operations[index];
      if (hash(await readFile(paths[index], 'utf8')) === op.beforeHash) await atomicWrite(paths[index], op.after);
    }
    throw error;
  }
  return { status: 'rolled-back', restored: restored.length };
}
