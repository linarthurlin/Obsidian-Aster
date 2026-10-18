import { readFile, writeFile, mkdir, copyFile, lstat, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export async function install(vaultPath) {
  const vault = await realpath(resolve(vaultPath));
  const targets = [
  {
    "path": ".obsidian/plugins/knowledge-agent",
    "from": "plugin",
    "files": [
      "main.js",
      "manifest.json",
      "styles.css"
    ]
  }
];
  // Check every existing parent before any mutation. Junctions must not escape the selected vault.
  for (const target of targets) {
    let cursor = vault;
    for (const part of target.path.split('/')) {
      cursor = join(cursor, part);
      try {
        const info = await lstat(cursor);
        if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Unsafe installation directory: ${cursor}`);
        const rel = relative(vault, await realpath(cursor));
        if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Installation escapes selected vault');
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const file of target.files) {
      await readFile(join(root, 'dist', target.from, file));
      try { if ((await lstat(join(vault, target.path, file))).isSymbolicLink()) throw new Error('Refusing linked installation file'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  const stamp = `${Date.now()}-${process.pid}`;
  const backup = join(root, '.local/backups', stamp);
  const copied = [];
  for (const target of targets) {
    const dir = join(vault, target.path);
    await mkdir(dir, { recursive: true });
    for (const file of target.files) {
      const dest = join(dir, file);
      try {
        const old = await readFile(dest);
        const stored = join(backup, target.from);
        await mkdir(stored, { recursive: true });
        await writeFile(join(stored, file), old);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      await copyFile(join(root, 'dist', target.from, file), dest);
      copied.push(join(target.path, file));
    }
  }
  await mkdir(backup, { recursive: true });
  await writeFile(join(backup, 'install.json'), JSON.stringify({ vault, copied, activated: false }, null, 2));
  return { copied, backup, activated: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--vault');
  if (index < 0 || !process.argv[index + 1]) throw new Error('Usage: npm run install:vault -- --vault <existing-vault-directory>');
  console.log(JSON.stringify(await install(process.argv[index + 1]), null, 2));
  console.log('Installed only Knowledge Agent plugin files. Enable it manually in Obsidian. No notes or existing configuration changed.');
}
