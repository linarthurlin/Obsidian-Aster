import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { it, expect } from 'vitest';
import { propose, review } from '../workflow/knowledge.mjs';

it('inspects and recovers a pending journal through the offline CLI using synthetic files only', async () => {
  const home = await mkdtemp(join(tmpdir(), 'aster-journal-cli-'));
  const vault = join(home, 'vault');
  const cli = fileURLToPath(new URL('../workflow/cli.mjs', import.meta.url));
  try {
    await mkdir(vault);
    await writeFile(join(vault, 'Note.md'), 'Original synthetic note.\n');
    await writeFile(join(vault, 'Source.md'), 'Synthetic supporting evidence.\n');
    const plan = await propose(vault, [{
      path: 'Note.md',
      after: 'Original synthetic note.\nAdded from evidence.\n',
      reason: 'Demonstrate journal recovery',
      sources: [{ path: 'Source.md', excerpt: 'Synthetic supporting evidence.' }],
    }]);
    const receipt = join(home, 'pending.json');
    await writeFile(receipt, JSON.stringify({
      status: 'pending',
      root: await realpath(vault),
      digest: review(plan).digest,
      plan,
    }));
    await writeFile(join(vault, 'Note.md'), plan.operations[0].after);

    const inspected = JSON.parse(execFileSync(process.execPath, [
      cli, 'inspect', '--vault', vault, '--transaction', receipt,
    ], { encoding: 'utf8' }));
    expect(inspected.targets).toEqual([{ path: 'Note.md', state: 'after' }]);
    expect(JSON.stringify(inspected)).not.toContain('Synthetic supporting evidence');

    const recovered = JSON.parse(execFileSync(process.execPath, [
      cli, 'recover', '--vault', vault, '--transaction', receipt,
    ], { encoding: 'utf8' }));
    expect(recovered).toEqual({ status: 'rolled-back', restored: 1, alreadyBefore: 0 });
    expect(await readFile(join(vault, 'Note.md'), 'utf8')).toBe('Original synthetic note.\n');
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
