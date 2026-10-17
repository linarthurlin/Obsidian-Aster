// Copies only plugin code into the repo's synthetic demo. Never copies personal plugin data.json.
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { install } from './install.mjs';
const demo = resolve('demo-vault');
await install(demo); // also checks the demo's .obsidian parents for junctions
const plugins = ['personal-glass'];
for (const id of ['notebook-navigator', 'crisp-craft']) {
  const source = resolve('.local/third-party', id), target = join(demo, '.obsidian/plugins', id);
  await mkdir(target, { recursive: true });
  for (const file of ['main.js', 'manifest.json', 'styles.css', ...(id === 'notebook-navigator' ? ['languages.json'] : [])]) await copyFile(join(source, file), join(target, file));
  plugins.push(id);
}
const index = process.argv.indexOf('--installed-from');
if (index >= 0 && process.argv[index + 1]) {
  const sourceVault = resolve(process.argv[index + 1]);
  for (const id of ['tables', 'advanced-canvas', 'ninja-cursor']) {
    const source = join(sourceVault, '.obsidian/plugins', id), target = join(demo, '.obsidian/plugins', id);
    await mkdir(target, { recursive: true });
    for (const file of ['main.js', 'manifest.json', 'styles.css']) {
      try { await copyFile(join(source, file), join(target, file)); }
      catch (error) { if (file !== 'styles.css' || error.code !== 'ENOENT') throw error; }
    }
    plugins.push(id);
  }
}
// Disable content-writing and external-image convenience features in the NN test fixture.
const nn = { showCalendar: false, downloadExternalFeatureImages: false, showFeatureImage: false,
  showFilePreview: false, showFileIconUnfinishedTask: false, showFileBackgroundUnfinishedTask: false };
await writeFile(join(demo, '.obsidian/plugins/notebook-navigator/data.json'), JSON.stringify(nn));
await writeFile(join(demo, '.obsidian/community-plugins.json'), JSON.stringify(plugins));
console.log(`Synthetic demo plugins prepared: ${plugins.join(', ')}. No personal plugin configuration copied.`);
