import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
await mkdir(resolve(root, 'dist/plugin'), { recursive: true });
await mkdir(resolve(root, 'dist/theme'), { recursive: true });
const files = ['tokens', 'shell', 'components', 'integrations', 'editor', 'fallback'];
const css = (await Promise.all(files.map(name => readFile(resolve(root, `src/styles/${name}.css`), 'utf8')))).join('\n');
await writeFile(resolve(root, 'dist/theme/theme.css'), css);
await copyFile(resolve(root, 'theme/manifest.json'), resolve(root, 'dist/theme/manifest.json'));
await copyFile(resolve(root, 'manifest.json'), resolve(root, 'dist/plugin/manifest.json'));
await writeFile(resolve(root, 'dist/plugin/styles.css'), await readFile(resolve(root, 'src/navigator.css'), 'utf8'));
await build({ entryPoints: [resolve(root, 'src/main.ts')], outfile: resolve(root, 'dist/plugin/main.js'),
  bundle: true, platform: 'node', format: 'cjs', target: 'es2022', external: ['obsidian', '@electron/remote'],
  sourcemap: false, banner: { js: '/* Personal Glass — MIT License */' } });
console.log('Built standalone theme and companion plugin into dist/.');
