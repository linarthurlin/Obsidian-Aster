import { readdir, lstat, readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join, basename } from 'node:path';
import { safePath, hash, propose, review } from './knowledge.mjs';
export const LIMITS = { files: 2000, bytes: 200000, searchBytes: 20000000, searchExcerptChars: 420, searchResults: 20, targetChars: 32000, batchTargets: 4, batchTargetChars: 48000, excerptChars: 2400, sources: 6 };
export function visiblePath(path) {
  return typeof path === 'string' && path.length > 0 && path.length < 1024 && !isAbsolute(path)
    && !/[\\:\u0000-\u001f]/.test(path) && path.split('/').every(part => part && !part.startsWith('.'));
}
export async function resolveScope(vault, folder) {
  if (!visiblePath(folder)) throw new Error('Choose a visible vault-relative folder; whole-vault scope is not allowed.');
  const base = await realpath(vault); let cursor = base;
  for (const part of folder.split('/')) {
    cursor = join(cursor, part); const info = await lstat(cursor);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Corpus folders cannot be symlinks/junctions.');
  }
  const rel = relative(base, await realpath(cursor));
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Corpus escapes the selected vault.');
  return cursor;
}
export async function listNotes(root) {
  root = await realpath(root); const files = []; let visited = 0;
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (++visited > LIMITS.files * 5) throw new Error('Corpus too large; select a smaller folder.');
      if (entry.name.startsWith('.') || entry.isSymbolicLink() || ['node_modules', '__pycache__'].includes(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.endsWith('.md')) {
        if (files.length >= LIMITS.files) throw new Error('Corpus exceeds 2000 Markdown files; select a smaller folder.');
        files.push(relative(root, path).replaceAll('\\', '/'));
      }
    }
  }
  await walk(root); return files.sort();
}
export function getCorpusBacklinks(folder, targetPath, notePaths, resolvedLinks) {
  if (!visiblePath(folder) || !visiblePath(targetPath) || !targetPath.endsWith('.md')) throw new Error('Choose a visible Corpus note to inspect backlinks.');
  if (!Array.isArray(notePaths) || notePaths.length > LIMITS.files) throw new Error('Corpus note listing is invalid or exceeds the file limit.');
  const prefix = folder + '/';
  const allowed = new Set(notePaths.filter(path => visiblePath(path) && path.endsWith('.md')).map(path => prefix + path));
  const target = prefix + targetPath;
  if (!allowed.has(target)) throw new Error('Backlink target is outside the configured Corpus.');
  if (!resolvedLinks || typeof resolvedLinks !== 'object') return [];
  return Object.entries(resolvedLinks)
    .filter(([source, targets]) => allowed.has(source) && targets && typeof targets === 'object'
      && Object.hasOwn(targets, target) && Number.isFinite(targets[target]) && targets[target] > 0)
    .map(([source]) => source.slice(prefix.length))
    .sort((a, b) => a.localeCompare(b));
}
export function getCorpusLinkHealth(folder, notePaths, resolvedLinks, unresolvedLinks) {
  if (!visiblePath(folder)) throw new Error('Choose a visible Corpus folder to inspect link health.');
  if (!Array.isArray(notePaths) || notePaths.length > LIMITS.files
    || notePaths.some(path => !visiblePath(path) || !path.endsWith('.md')))
    throw new Error('Corpus note listing is invalid or exceeds the file limit.');
  if (!resolvedLinks || typeof resolvedLinks !== 'object' || !unresolvedLinks || typeof unresolvedLinks !== 'object')
    throw new Error('Obsidian link metadata is unavailable; no report was produced.');
  const prefix = folder + '/';
  const allowed = new Set(notePaths.map(path => prefix + path));
  const unresolved = [];
  for (const source of allowed) {
    const links = unresolvedLinks[source];
    if (!links || typeof links !== 'object') continue;
    for (const [target, count] of Object.entries(links)) {
      if (!target.trim() || !Number.isSafeInteger(count) || count <= 0) continue;
      unresolved.push({ sourcePath: source.slice(prefix.length), target, count });
    }
  }
  unresolved.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath) || a.target.localeCompare(b.target));
  const inboundCounts = new Map();
  for (const source of allowed) {
    const targets = resolvedLinks[source];
    if (!targets || typeof targets !== 'object') continue;
    for (const [target, count] of Object.entries(targets)) {
      if (!allowed.has(target) || source === target || !Number.isSafeInteger(count) || count <= 0) continue;
      inboundCounts.set(target, (inboundCounts.get(target) || 0) + count);
    }
  }
  const noInbound = notePaths.filter(path => !inboundCounts.has(prefix + path)).sort((a, b) => a.localeCompare(b));
  return { unresolved, noInbound };
}
export function getCorpusTitleCollisions(folder, notePaths) {
  if (!visiblePath(folder)) throw new Error('Choose a visible Corpus folder to inspect note titles.');
  if (!Array.isArray(notePaths) || notePaths.length > LIMITS.files
    || notePaths.some(path => !visiblePath(path) || !path.endsWith('.md')))
    throw new Error('Corpus note listing is invalid or exceeds the file limit.');
  const groups = new Map();
  for (const path of notePaths) {
    const title = basename(path, '.md');
    const key = title.normalize('NFKC').toLowerCase();
    const group = groups.get(key) || { paths: [] };
    group.paths.push(path);
    groups.set(key, group);
  }
  const comparePaths = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  return [...groups.values()]
    .filter(group => group.paths.length > 1)
    .map(group => {
      const paths = group.paths.sort(comparePaths);
      return { title: basename(paths[0], '.md').normalize('NFKC'), paths };
    })
    .sort((a, b) => comparePaths(a.title, b.title));
}
async function boundedRead(root, path) {
  const absolute = await safePath(root, path), info = await lstat(absolute);
  if (info.size > LIMITS.bytes) throw new Error('Note exceeds the 200KB limit: ' + path);
  const bytes = await readFile(absolute);
  if (bytes.length > LIMITS.bytes) throw new Error('Note grew beyond the limit: ' + path);
  return bytes.toString('utf8');
}
async function searchableNotes(root) {
  const documents = [];
  let totalBytes = 0;
  for (const path of await listNotes(root)) {
    const info = await lstat(await safePath(root, path));
    if (info.size > LIMITS.bytes) continue;
    totalBytes += info.size;
    if (totalBytes > LIMITS.searchBytes) throw new Error('Corpus exceeds the 20MB local search budget; choose a smaller folder.');
    documents.push({ path, size: info.size });
  }
  return documents;
}
export async function searchCorpus(root, query, limit = LIMITS.searchResults) {
  if (typeof query !== 'string' || !query.trim() || query.length > 500) throw new Error('Enter a search query of 1–500 characters.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Search result limit must be between 1 and 50.');
  root = await realpath(root);
  const terms = query.normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean);
  const documents = await searchableNotes(root);
  const hits = [];
  let scannedBytes = 0;
  for (const document of documents) {
    const text = await boundedRead(root, document.path);
    scannedBytes += Buffer.byteLength(text, 'utf8');
    if (scannedBytes > LIMITS.searchBytes) throw new Error('Corpus changed beyond the 20MB local search budget; choose a smaller folder.');
    const normalized = text.normalize('NFKC').toLowerCase();
    const path = document.path.normalize('NFKC').toLowerCase();
    const score = terms.reduce((sum, term) => sum + (path.includes(term) ? 5 : 0) + (normalized.includes(term) ? 2 : 0), 0);
    if (!score) continue;
    const originalMatch = terms.map(term => text.toLowerCase().indexOf(term)).filter(index => index >= 0);
    const at = originalMatch.length ? Math.min(...originalMatch) : 0;
    const from = Math.max(0, text.lastIndexOf('\n', Math.max(0, at - 180)) + 1);
    hits.push({
      path: document.path,
      score,
      excerpt: text.slice(from, from + LIMITS.searchExcerptChars),
      startLine: text.slice(0, from).split('\n').length,
    });
  }
  const ordered = hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return { query: query.trim(), scannedFiles: documents.length, scannedBytes, truncated: ordered.length > limit, results: ordered.slice(0, limit) };
}
export async function prepareContext(root, query, targetPath) {
  if (typeof query !== 'string' || !query.trim() || query.length > 1000) throw new Error('Enter a query of 1–1000 characters.');
  if (!visiblePath(targetPath) || !targetPath.endsWith('.md')) throw new Error('Select an existing Markdown target.');
  const documents = await searchableNotes(root);
  const targetText = await boundedRead(root, targetPath);
  if (targetText.length > LIMITS.targetChars) throw new Error('Target exceeds 32000 characters; choose a smaller note.');
  const terms = query.normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean), hits = [];
  let scannedBytes = 0;
  for (const { path } of documents) {
    if (path === targetPath) continue;
    const text = await boundedRead(root, path), lower = text.normalize('NFKC').toLowerCase();
    scannedBytes += Buffer.byteLength(text, 'utf8');
    if (scannedBytes > LIMITS.searchBytes) throw new Error('Corpus changed beyond the 20MB search budget; choose a smaller folder.');
    const score = terms.reduce((sum, term) => sum + (path.toLowerCase().includes(term) ? 5 : 0) + (lower.includes(term) ? 2 : 0), 0);
    if (!score) continue;
    // Use original text offsets so excerpts remain verifiable, even with Unicode normalization.
    const at = Math.max(0, text.toLowerCase().indexOf(terms.find(term => text.toLowerCase().includes(term)) || terms[0]));
    const from = Math.max(0, text.lastIndexOf('\n', Math.max(0, at - 240)) + 1);
    const excerpt = text.slice(from, from + LIMITS.excerptChars);
    hits.push({ path, hash: hash(text), excerpt, startLine: text.slice(0, from).split('\n').length, score });
  }
  const sources = hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, LIMITS.sources);
  if (!sources.length) throw new Error('No matching source notes in this corpus. Change the query; nothing was sent.');
  return { schema: 1, query: query.trim(), target: { path: targetPath, hash: hash(targetText), text: targetText }, sources };
}
export async function prepareBatchContext(root, query, targetPaths) {
  if (typeof query !== 'string' || !query.trim() || query.length > 1000) throw new Error('Enter a query of 1–1000 characters.');
  if (!Array.isArray(targetPaths) || targetPaths.length < 2 || targetPaths.length > LIMITS.batchTargets
    || targetPaths.some(path => !visiblePath(path) || !path.endsWith('.md')) || new Set(targetPaths).size !== targetPaths.length)
    throw new Error(`Select 2–${LIMITS.batchTargets} distinct Markdown targets in the configured Corpus.`);
  root = await realpath(root);
  const documents = await searchableNotes(root);
  const available = new Set(documents.map(document => document.path));
  const targetSet = new Set(targetPaths);
  const targets = [];
  let targetChars = 0;
  for (const path of targetPaths) {
    if (!available.has(path)) throw new Error('Target is outside the searchable Corpus or exceeds the note size limit: ' + path);
    const text = await boundedRead(root, path);
    targetChars += text.length;
    if (targetChars > LIMITS.batchTargetChars) throw new Error('Selected targets exceed the 48000-character combined context limit. Choose fewer or smaller notes.');
    targets.push({ path, hash: hash(text), text });
  }
  const terms = query.normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean), hits = [];
  let scannedBytes = 0;
  for (const { path } of documents) {
    if (targetSet.has(path)) continue;
    const text = await boundedRead(root, path), lower = text.normalize('NFKC').toLowerCase();
    scannedBytes += Buffer.byteLength(text, 'utf8');
    if (scannedBytes > LIMITS.searchBytes) throw new Error('Corpus changed beyond the 20MB search budget; choose a smaller folder.');
    const score = terms.reduce((sum, term) => sum + (path.normalize('NFKC').toLowerCase().includes(term) ? 5 : 0) + (lower.includes(term) ? 2 : 0), 0);
    if (!score) continue;
    const at = Math.max(0, text.toLowerCase().indexOf(terms.find(term => text.toLowerCase().includes(term)) || terms[0]));
    const from = Math.max(0, text.lastIndexOf('\n', Math.max(0, at - 240)) + 1);
    hits.push({ path, hash: hash(text), excerpt: text.slice(from, from + LIMITS.excerptChars),
      startLine: text.slice(0, from).split('\n').length, score });
  }
  const sources = hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, LIMITS.sources);
  if (!sources.length) throw new Error('No matching source notes in this corpus. Change the query; nothing was sent.');
  return { schema: 2, query: query.trim(), targets, sources };
}
export function contextDigest(context) { return hash(JSON.stringify(context)); }
export async function assertContextFresh(root, context) {
  const targets = Array.isArray(context.targets) ? context.targets : [context.target];
  for (const target of targets) if (hash(await boundedRead(root, target.path)) !== target.hash) throw new Error('Target changed. Prepare a new context: ' + target.path);
  for (const source of context.sources) if (hash(await boundedRead(root, source.path)) !== source.hash) throw new Error('Source changed. Prepare a new context: ' + source.path);
}
export function validateSuggestion(context, output) {
  if (!output || !['proposal', 'no_change'].includes(output.status) || typeof output.reason !== 'string' || !output.reason.trim()
    || output.reason.length > 4000 || typeof output.after !== 'string' || output.after.length > LIMITS.targetChars || !Array.isArray(output.sources)
    || output.sources.length > LIMITS.sources) throw new Error('Invalid model proposal.');
  if (output.status === 'no_change') {
    if (output.after !== context.target.text || output.sources.length) throw new Error('A no-change result must preserve the target exactly.');
    return output;
  }
  if (!output.sources.length || output.after === context.target.text || !output.after.trim()) throw new Error('An update requires a change and exact source citations.');
  for (const source of output.sources) {
    const allowed = context.sources.find(item => item.path === source.path);
    if (!allowed || typeof source.excerpt !== 'string' || !source.excerpt.trim() || !allowed.excerpt.includes(source.excerpt)) throw new Error('Model cited evidence outside the approved excerpts.');
  }
  return output;
}
export async function suggestionPlan(root, context, output) {
  validateSuggestion(context, output); await assertContextFresh(root, context);
  if (output.status === 'no_change') return null;
  const plan = await propose(root, [{ path: context.target.path, after: output.after, reason: output.reason,
    sources: output.sources.map(source => ({ ...source, locator: 'Approved excerpt beginning at line ' + context.sources.find(item => item.path === source.path).startLine })) }]);
  if (plan.operations[0].beforeHash !== context.target.hash || plan.operations[0].sources.some(source => source.hash !== context.sources.find(item => item.path === source.path).hash)) throw new Error('Context changed during proposal creation.');
  return { plan, review: review(plan) };
}
export function validateBatchSuggestion(context, output) {
  if (!context || context.schema !== 2 || !Array.isArray(context.targets) || context.targets.length < 2
    || context.targets.length > LIMITS.batchTargets || !Array.isArray(context.sources)
    || !output || !['proposal', 'no_change'].includes(output.status) || typeof output.reason !== 'string' || !output.reason.trim()
    || output.reason.length > 4000 || !Array.isArray(output.operations) || output.operations.length > context.targets.length)
    throw new Error('Invalid multi-note proposal.');
  const targets = new Map(context.targets.map(target => [target.path, target]));
  const seen = new Set();
  if (output.status === 'no_change') {
    if (output.operations.length) throw new Error('A no-change result cannot contain operations.');
    return output;
  }
  if (!output.operations.length) throw new Error('A multi-note update needs at least one reviewed change.');
  for (const operation of output.operations) {
    const target = targets.get(operation?.path);
    if (!target || seen.has(operation.path)) throw new Error('Proposal contains an unselected or duplicate target.');
    seen.add(operation.path);
    if (typeof operation.reason !== 'string' || !operation.reason.trim() || operation.reason.length > 4000
      || typeof operation.after !== 'string' || operation.after.length > LIMITS.targetChars || !operation.after.trim()
      || operation.after === target.text || !Array.isArray(operation.sources) || !operation.sources.length || operation.sources.length > LIMITS.sources)
      throw new Error('Invalid change for selected target: ' + operation.path);
    for (const source of operation.sources) {
      const allowed = context.sources.find(item => item.path === source?.path);
      if (!allowed || typeof source.excerpt !== 'string' || !source.excerpt.trim() || !allowed.excerpt.includes(source.excerpt))
        throw new Error('Model cited evidence outside the approved excerpts.');
    }
  }
  return output;
}
export async function batchSuggestionPlan(root, context, output) {
  validateBatchSuggestion(context, output);
  await assertContextFresh(root, context);
  if (output.status === 'no_change') return null;
  const operations = output.operations.map(operation => ({ path: operation.path, after: operation.after, reason: operation.reason,
    sources: operation.sources.map(source => ({ ...source, locator: 'Approved excerpt beginning at line ' + context.sources.find(item => item.path === source.path).startLine })) }));
  const plan = await propose(root, operations);
  for (const operation of plan.operations) {
    const target = context.targets.find(item => item.path === operation.path);
    if (!target || operation.beforeHash !== target.hash) throw new Error('Context changed during proposal creation: ' + operation.path);
    for (const source of operation.sources) if (source.hash !== context.sources.find(item => item.path === source.path)?.hash)
      throw new Error('Context changed during proposal creation: ' + source.path);
  }
  return { plan, review: review(plan) };
}
