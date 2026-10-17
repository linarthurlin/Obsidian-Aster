import { readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import postcss from 'postcss';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
for (const dir of ['theme', 'plugin']) {
  const manifest = JSON.parse(await readFile(`dist/${dir}/manifest.json`, 'utf8'));
  assert.equal(manifest.version, pkg.version, `${dir} version differs from package.json`);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert(manifest.name && manifest.minAppVersion && manifest.author);
}
const css = await readFile('dist/theme/theme.css', 'utf8');
postcss.parse(css);
assert(!/@import\b|https?:\/\//i.test(css), 'Theme must work without external resources');
assert(!/opacity:\s*0\.[0-9]+\s*;/.test(css), 'Do not reduce opacity of text-containing surfaces');
assert(css.includes('prefers-reduced-motion') && css.includes('forced-colors'));
assert((await stat('dist/plugin/main.js')).size > 0);
console.log('Validated CSS, versions, manifests and offline theme assets.');
