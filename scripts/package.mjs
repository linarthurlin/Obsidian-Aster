import { zipSync, strToU8 } from 'fflate';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('release', { recursive: true });
const hashes = [];
for (const [kind, names] of [['theme', ['theme.css', 'manifest.json']], ['plugin', ['main.js', 'manifest.json', 'styles.css']]]) {
  const files = {};
  for (const name of names) files[name] = new Uint8Array(await readFile(`dist/${kind}/${name}`));
  files['LICENSE'] = strToU8(await readFile('LICENSE', 'utf8'));
  const name = `personal-glass-${kind}-${pkg.version}.zip`;
  const bytes = zipSync(files);
  await writeFile(`release/${name}`, bytes);
  hashes.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
}
const tools = {};
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await collect(path);
    else if (entry.isFile()) tools[path] = new Uint8Array(await readFile(path));
  }
}
await collect('workflow');
await collect('skills/personal-glass-svg');
tools.LICENSE = strToU8(await readFile('LICENSE', 'utf8'));
const toolsName = `personal-glass-tools-${pkg.version}.zip`;
const toolsBytes = zipSync(tools);
await writeFile(`release/${toolsName}`, toolsBytes);
hashes.push(`${createHash('sha256').update(toolsBytes).digest('hex')}  ${toolsName}`);
// Root release assets support manual installation and BRAT for the companion plugin.
for (const name of ['main.js', 'manifest.json', 'styles.css']) {
  const bytes = await readFile(`dist/plugin/${name}`);
  await writeFile(`release/${name}`, bytes);
  hashes.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
}
await writeFile('release/SHA256SUMS.txt', hashes.join('\n') + '\n');
console.log(`Packaged theme + plugin + offline tools ${pkg.version} with checksums.`);
