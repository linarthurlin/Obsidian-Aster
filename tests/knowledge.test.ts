import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { propose, review, apply, rollback, rollbackTransactionJournal, inspectTransactionJournal, listTransactionJournals, readTransactionReview, recoverTransactionJournal, safePath, hash, diff } from '../workflow/knowledge.mjs';
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'glass-workflow-'));
  const vault = join(home, 'vault'); await mkdir(vault);
  await writeFile(join(vault, 'Note.md'), '# Original\n\nHuman text.\n');
  await writeFile(join(vault, 'Source.md'), '# Source\n\nExact evidence.\n');
  const operations = [{ path: 'Note.md', after: '# Original\n\nHuman text.\n\nExact evidence. [[Source]]\n', reason: 'Add supported detail', sources: [{ path: 'Source.md', excerpt: 'Exact evidence.', locator: 'Source heading' }] }];
  return { home, vault, operations };
}
describe('offline review boundary', () => {
  it('plans without writing and applies/rolls back the exact reviewed update', async () => {
    const f = await fixture(), original = await readFile(join(f.vault, 'Note.md'), 'utf8');
    const plan = await propose(f.vault, f.operations), approved = review(plan);
    expect(await readFile(join(f.vault, 'Note.md'), 'utf8')).toBe(original);
    expect(approved.changes[0].diff).toContain('+Exact evidence. [[Source]]');
    const receipt = join(f.home, 'transaction.json');
    expect(await apply(f.vault, plan, approved.digest, receipt)).toEqual({ status: 'applied', updated: 1 });
    expect(await readFile(join(f.vault, 'Note.md'), 'utf8')).toBe(f.operations[0].after);
    await rollbackTransactionJournal(f.vault, receipt);
    expect(await readFile(join(f.vault, 'Note.md'), 'utf8')).toBe(original);
    expect(JSON.parse(await readFile(receipt, 'utf8')).status).toBe('rolled-back');
  });
  it('rejects fabricated evidence, path traversal and mismatched review digests', async () => {
    const f = await fixture();
    await expect(propose(f.vault, [{ ...f.operations[0], sources: [{ path: 'Source.md', excerpt: 'Invented' }] }])).rejects.toThrow('Source excerpt');
    await expect(safePath(f.vault, '../outside.md')).rejects.toThrow('vault-relative');
    await expect(safePath(f.vault, '.obsidian/app.json')).rejects.toThrow('vault-relative');
    const plan = await propose(f.vault, f.operations);
    await expect(apply(f.vault, plan, 'wrong', join(f.home, 'receipt.json'))).rejects.toThrow('digest');
  });
  it('refuses stale targets and changed sources before any target is written', async () => {
    const f = await fixture(), plan = await propose(f.vault, f.operations);
    await writeFile(join(f.vault, 'Source.md'), 'Changed evidence');
    await expect(apply(f.vault, plan, review(plan).digest, join(f.home, 'receipt.json'))).rejects.toThrow('Source changed');
    expect(hash(await readFile(join(f.vault, 'Note.md'), 'utf8'))).toBe(plan.operations[0].beforeHash);
  });
  it('refuses rollback over subsequent human edits and reuse of a journal path', async () => {
    const f = await fixture(), plan = await propose(f.vault, f.operations), receipt = join(f.home, 'receipt.json');
    await apply(f.vault, plan, review(plan).digest, receipt);
    await writeFile(join(f.vault, 'Note.md'), 'A later human edit');
    await expect(rollback(f.vault, JSON.parse(await readFile(receipt, 'utf8')))).rejects.toThrow('Content changed');
    await expect(apply(f.vault, plan, review(plan).digest, receipt)).rejects.toThrow();
    expect(await readFile(join(f.vault, 'Note.md'), 'utf8')).toBe('A later human edit');
  });
  it('rejects junctions/symlinks and transaction journals inside the vault', async () => {
    const f = await fixture(), outside = join(f.home, 'outside'); await mkdir(outside);
    await writeFile(join(outside, 'Source.md'), 'Exact evidence.');
    await symlink(outside, join(f.vault, 'Linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(safePath(f.vault, 'Linked/Source.md')).rejects.toThrow('Symlinks');
    const plan = await propose(f.vault, f.operations);
    await expect(apply(f.vault, plan, review(plan).digest, join(f.vault, 'Note.md'))).rejects.toThrow('outside');
    await expect(apply(f.vault, plan, review(plan).digest, join(f.vault, '..receipts', 'receipt.json'))).rejects.toThrow('outside');
  });
  it('rejects modified plan contents and duplicate targets', async () => {
    const f = await fixture(), plan = await propose(f.vault, f.operations);
    plan.operations[0].after += 'Tampered';
    expect(() => review(plan)).toThrow('Corrupt');
    await expect(propose(f.vault, [...f.operations, ...f.operations])).rejects.toThrow('Duplicate');
    expect(diff('Note.md', 'same', 'same')).toContain('No changes');
  });
  it('preflights every target before writing a multi-note proposal', async () => {
    const f = await fixture();
    await writeFile(join(f.vault, 'Second.md'), 'Second original');
    const plan = await propose(f.vault, [...f.operations, { ...f.operations[0], path: 'Second.md', after: 'Second updated' }]);
    await writeFile(join(f.vault, 'Second.md'), 'A concurrent human edit');
    await expect(apply(f.vault, plan, review(plan).digest, join(f.home, 'receipt.json'))).rejects.toThrow('Content changed');
    expect(hash(await readFile(join(f.vault, 'Note.md'), 'utf8'))).toBe(plan.operations[0].beforeHash);
    const linked = join(f.home, 'alias');
    await symlink(f.vault, linked, process.platform === 'win32' ? 'junction' : 'dir');
    await expect(apply(f.vault, plan, review(plan).digest, join(linked, 'receipt.json'))).rejects.toThrow('outside');
  });
  it('inspects and resumes a pending journal by restoring only known after-state targets', async () => {
    const f = await fixture();
    const secondBefore = '# Second original\n';
    const secondAfter = '# Second updated\n';
    await writeFile(join(f.vault, 'Second.md'), secondBefore);
    const plan = await propose(f.vault, [
      f.operations[0],
      { ...f.operations[0], path: 'Second.md', before: undefined, after: secondAfter },
    ]);
    const receipt = join(f.home, 'pending.json');
    await writeFile(receipt, JSON.stringify({
      status: 'pending', root: await realpath(f.vault), digest: review(plan).digest, plan,
    }));
    await writeFile(join(f.vault, 'Note.md'), plan.operations[0].after);

    expect((await inspectTransactionJournal(f.vault, receipt)).targets).toEqual([
      { path: 'Note.md', state: 'after' },
      { path: 'Second.md', state: 'before' },
    ]);
    await expect(recoverTransactionJournal(f.vault, receipt)).resolves.toEqual({
      status: 'rolled-back', restored: 1, alreadyBefore: 1,
    });
    expect(await readFile(join(f.vault, 'Note.md'), 'utf8')).toBe(plan.operations[0].before);
    expect(await readFile(join(f.vault, 'Second.md'), 'utf8')).toBe(secondBefore);
    expect(JSON.parse(await readFile(receipt, 'utf8')).status).toBe('rolled-back');
    await expect(recoverTransactionJournal(f.vault, receipt)).rejects.toThrow('not in a recoverable state');
  });
  it('blocks pending recovery before any write when one target contains an unknown edit', async () => {
    const f = await fixture();
    await writeFile(join(f.vault, 'Second.md'), '# Second original\n');
    const plan = await propose(f.vault, [
      f.operations[0],
      { ...f.operations[0], path: 'Second.md', before: undefined, after: '# Second updated\n' },
    ]);
    const receipt = join(f.home, 'pending.json');
    await writeFile(receipt, JSON.stringify({
      status: 'pending', root: await realpath(f.vault), digest: review(plan).digest, plan,
    }));
    await writeFile(join(f.vault, 'Note.md'), plan.operations[0].after);
    await writeFile(join(f.vault, 'Second.md'), '# A later human edit\n');

    await expect(recoverTransactionJournal(f.vault, receipt)).rejects.toThrow('Second.md');
    expect(await readFile(join(f.vault, 'Note.md'), 'utf8')).toBe(plan.operations[0].after);
    expect(await readFile(join(f.vault, 'Second.md'), 'utf8')).toBe('# A later human edit\n');
    expect(JSON.parse(await readFile(receipt, 'utf8')).status).toBe('pending');
  });
  it('resumes a recovering journal idempotently after a restart', async () => {
    const f = await fixture();
    const plan = await propose(f.vault, f.operations);
    const receipt = join(f.home, 'recovering.json');
    await writeFile(receipt, JSON.stringify({
      status: 'recovering',
      root: await realpath(f.vault),
      digest: review(plan).digest,
      plan,
      recovery: { action: 'rollback', startedAt: '2026-10-18T00:00:00.000Z', restored: ['Note.md'] },
    }));

    await expect(recoverTransactionJournal(f.vault, receipt)).resolves.toEqual({
      status: 'rolled-back', restored: 0, alreadyBefore: 1,
    });
    expect((await inspectTransactionJournal(f.vault, receipt)).recovery).toMatchObject({
      action: 'rollback', restoredCount: 1,
    });
  });
  it('lists private journals by Corpus and loads the exact saved review only on request', async () => {
    const f = await fixture();
    const plan = await propose(f.vault, f.operations);
    const transactionDirectory = join(f.home, 'transactions');
    await mkdir(transactionDirectory);
    const receipt = join(transactionDirectory, plan.id + '-synthetic.private.json');
    await apply(f.vault, plan, review(plan).digest, receipt);

    const history = await listTransactionJournals(f.vault, transactionDirectory);
    expect(history.skipped).toBe(0);
    expect(history.items).toEqual([{
      path: receipt,
      status: 'applied',
      planId: plan.id,
      createdAt: plan.createdAt,
      targetPaths: ['Note.md'],
    }]);
    const selected = await readTransactionReview(f.vault, receipt);
    expect(selected.changes[0].diff).toContain('+Exact evidence. [[Source]]');
    expect(selected.targets).toEqual([{ path: 'Note.md', state: 'after' }]);

    const otherVault = join(f.home, 'other-vault');
    await mkdir(otherVault);
    const unrelated = await listTransactionJournals(otherVault, transactionDirectory);
    expect(unrelated.items).toEqual([]);
    expect(unrelated.skipped).toBe(1);
  });
});
