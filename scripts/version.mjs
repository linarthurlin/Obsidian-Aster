import { readFile, writeFile } from 'node:fs/promises';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('Obsidian versions must use x.y.z');
for (const path of ['manifest.json', 'theme/manifest.json']) {
  const json = JSON.parse(await readFile(path, 'utf8'));
  json.version = pkg.version;
  await writeFile(path, JSON.stringify(json, null, 2) + '\n');
}
const versions = JSON.parse(await readFile('versions.json', 'utf8'));
versions[pkg.version] = JSON.parse(await readFile('manifest.json', 'utf8')).minAppVersion;
await writeFile('versions.json', JSON.stringify(versions, null, 2) + '\n');
