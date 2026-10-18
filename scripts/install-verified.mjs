// Local-only deployment verification; paths/hashes are not published.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { install } from './install.mjs';
const index = process.argv.indexOf('--vault');
assert(index >= 0 && process.argv[index + 1], 'Supply --vault <existing directory>');
const vault = resolve(process.argv[index + 1]);
async function snapshot() {
  const hashes = {};
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !['node_modules', '__pycache__', 'cache'].includes(entry.name)) await walk(path);
      } else if (entry.name.endsWith('.md')) {
        hashes[relative(vault, path)] = createHash('sha256').update(await readFile(path)).digest('hex');
      }
    }
  }
  await walk(vault);
  for (const name of ['appearance.json', 'app.json', 'community-plugins.json', 'core-plugins.json']) {
    try { hashes[`.obsidian/${name}`] = createHash('sha256').update(await readFile(join(vault, '.obsidian', name))).digest('hex'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return hashes;
}
const before = await snapshot();
const result = await install(vault);
const after = await snapshot();
assert.deepEqual(after, before, 'Unexpected note/config change detected');
await mkdir('.local', { recursive: true });
await writeFile('.local/deployment-verification.json', JSON.stringify({ timestamp: new Date().toISOString(), verifiedFiles: Object.keys(before).length, unchanged: true, ...result }, null, 2));
console.log(`Installed three plugin distribution files; verified ${Object.keys(before).length} existing Markdown/config files unchanged. Nothing activated.`);
