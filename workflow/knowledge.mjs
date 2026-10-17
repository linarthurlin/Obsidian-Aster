// Offline proposal/review engine. No model, network calls, automatic classification or background writes.
import { readFile, writeFile, lstat, realpath, rename, unlink, mkdir, stat, open } from 'node:fs/promises';
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
  const { readdir } = await import('node:fs/promises');
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
  const temp = join(dirname(path), `.personal-glass-${randomUUID()}.tmp`);
  const mode = (await stat(path)).mode;
  try { await writeFile(temp, text, { flag: 'wx', mode }); await rename(temp, path); }
  finally { try { await unlink(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
}
export async function apply(root, plan, digest, transactionPath) {
  if (review(plan).digest !== digest) throw new Error('Review digest does not match this exact plan');
  root = await realpath(root);
  // Keep transaction history outside the vault; never overwrite notes with a receipt.
  let receipt = resolve(transactionPath);
  const rel = relative(root, receipt);
  const outside = path => path === '..' || path.startsWith('..' + sep) || isAbsolute(path);
  if (!outside(rel)) throw new Error('Transaction history must be outside the vault');
  await mkdir(dirname(receipt), { recursive: true });
  receipt = join(await realpath(dirname(receipt)), basename(receipt));
  const resolvedRel = relative(root, receipt);
  if (!outside(resolvedRel)) throw new Error('Transaction history must resolve outside the vault');
  const log = await open(receipt, 'wx');
  const changed = [];
  try {
    const paths = await preflight(root, plan);
    // Write a recovery journal before the first mutation, then mark successful completion.
    await log.writeFile(JSON.stringify({ status: 'pending', root, digest, plan }, null, 2));
    await log.sync();
    for (let index = 0; index < plan.operations.length; index++) {
      const op = plan.operations[index];
      if (hash(await readFile(await safePath(root, op.path), 'utf8')) !== op.beforeHash) throw new Error(`Concurrent edit: ${op.path}`);
      await atomicWrite(paths[index], op.after); changed.push(index);
    }
    await log.truncate(0); await log.write(JSON.stringify({ status: 'applied', root, digest, plan }, null, 2), 0, 'utf8'); await log.sync();
    return { status: 'applied', updated: changed.length };
  } catch (error) {
    // Do not overwrite an external edit made after our own write.
    const conflicts = [];
    for (const index of changed.reverse()) {
      const op = plan.operations[index];
      const path = await safePath(root, op.path);
      if (hash(await readFile(path, 'utf8')) === op.afterHash) await atomicWrite(path, op.before); else conflicts.push(op.path);
    }
    await log.truncate(0); await log.write(JSON.stringify({ status: conflicts.length ? 'recovery-required' : 'aborted', root, digest, plan, conflicts }, null, 2), 0, 'utf8'); await log.sync();
    throw error;
  } finally { await log.close(); }
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
