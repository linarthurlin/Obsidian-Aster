import { readFile, writeFile } from 'node:fs/promises';
import { renderFlow } from '../skills/personal-glass-svg/scripts/render-flow.mjs';
for (const name of ['knowledge', 'research', 'engineering']) {
  const input = JSON.parse(await readFile(`skills/personal-glass-svg/examples/${name}.json`, 'utf8'));
  for (const mode of ['light', 'dark']) await writeFile(`demo-vault/assets/${name}-${mode}.svg`, renderFlow(input, mode));
}
