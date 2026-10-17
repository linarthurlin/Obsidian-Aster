import { zipSync, strToU8 } from 'fflate';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
// Root release assets support manual installation and BRAT for the companion plugin.
for (const name of ['main.js', 'manifest.json', 'styles.css']) {
  const bytes = await readFile(`dist/plugin/${name}`);
  await writeFile(`release/${name}`, bytes);
  hashes.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
}
await writeFile('release/SHA256SUMS.txt', hashes.join('\n') + '\n');
console.log(`Packaged theme + plugin ${pkg.version} with checksums.`);
