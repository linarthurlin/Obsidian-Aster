import { it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertContextFresh, batchSuggestionPlan, prepareBatchContext, validateBatchSuggestion } from '../workflow/corpus.mjs';

it('previews bounded multi-note context and creates one provenance-checked operation per selected target', async () => {
  const home = await mkdtemp(join(tmpdir(), 'aster-batch-corpus-'));
  const corpus = join(home, 'Corpus');
  await mkdir(corpus);
  try {
    await writeFile(join(corpus, 'Idea A.md'), '# Idea A\nExisting A.\n');
    await writeFile(join(corpus, 'Idea B.md'), '# Idea B\nExisting B.\n');
    await writeFile(join(corpus, 'Evidence.md'), '# Evidence\nNeural plasticity changes with repeated practice.');
    const context = await prepareBatchContext(corpus, 'neural plasticity', ['Idea A.md', 'Idea B.md']);
    expect(context.targets.map(target => target.path)).toEqual(['Idea A.md', 'Idea B.md']);
    expect(context.sources.map(source => source.path)).toEqual(['Evidence.md']);
    expect(context.sources.some(source => context.targets.some(target => target.path === source.path))).toBe(false);

    const excerpt = context.sources[0].excerpt.slice(0, 24);
    const proposal = { status: 'proposal' as const, reason: 'Evidence supports two separate notes.', operations: context.targets.map((target, index) => ({
      path: target.path,
      reason: `Add a concise evidence-backed detail to ${target.path}.`,
      after: target.text + `\nEvidence-backed detail ${index + 1}.\n`,
      sources: [{ path: context.sources[0].path, excerpt }],
    })) };
    validateBatchSuggestion(context, proposal);
    const reviewed = await batchSuggestionPlan(corpus, context, proposal);
    expect(reviewed?.review.changes.map(change => change.path)).toEqual(['Idea A.md', 'Idea B.md']);
    expect(reviewed?.review.changes.every(change => change.diff.includes('+Evidence-backed detail'))).toBe(true);
    expect(await readFile(join(corpus, 'Idea A.md'), 'utf8')).toBe('# Idea A\nExisting A.\n');
    expect(await readFile(join(corpus, 'Idea B.md'), 'utf8')).toBe('# Idea B\nExisting B.\n');

    await writeFile(join(corpus, 'Idea B.md'), '# Idea B\nHuman edit.\n');
    await expect(assertContextFresh(corpus, context)).rejects.toThrow('Target changed');
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

it('rejects duplicate, unselected, unsupported and oversized batch changes', async () => {
  const home = await mkdtemp(join(tmpdir(), 'aster-batch-invalid-'));
  const corpus = join(home, 'Corpus');
  await mkdir(corpus);
  try {
    await writeFile(join(corpus, 'One.md'), 'Target one.');
    await writeFile(join(corpus, 'Two.md'), 'Target two.');
    await writeFile(join(corpus, 'Source.md'), 'Approved evidence excerpt.');
    const context = await prepareBatchContext(corpus, 'evidence', ['One.md', 'Two.md']);
    const base = (path: string) => ({ path, reason: 'Supported update.', after: 'Updated note.', sources: [{ path: 'Source.md', excerpt: 'Approved evidence' }] });
    expect(() => validateBatchSuggestion(context, { status: 'proposal', reason: 'Update.', operations: [base('One.md'), base('One.md')] })).toThrow('duplicate');
    expect(() => validateBatchSuggestion(context, { status: 'proposal', reason: 'Update.', operations: [base('Outside.md')] })).toThrow('unselected');
    expect(() => validateBatchSuggestion(context, { status: 'proposal', reason: 'Update.', operations: [{ ...base('One.md'), sources: [{ path: 'Source.md', excerpt: 'invented evidence' }] }] })).toThrow('approved excerpts');
    expect(() => validateBatchSuggestion(context, { status: 'proposal', reason: 'Update.', operations: [{ ...base('One.md'), after: 'x'.repeat(32001) }] })).toThrow('Invalid change');
    expect(validateBatchSuggestion(context, { status: 'no_change', reason: 'Evidence is insufficient.', operations: [] }).status).toBe('no_change');
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

it('rejects a multi-target context that exceeds the combined note budget before model use', async () => {
  const home = await mkdtemp(join(tmpdir(), 'aster-batch-budget-'));
  const corpus = join(home, 'Corpus');
  await mkdir(corpus);
  try {
    await writeFile(join(corpus, 'One.md'), 'a'.repeat(25000));
    await writeFile(join(corpus, 'Two.md'), 'b'.repeat(25000));
    await writeFile(join(corpus, 'Evidence.md'), 'bounded source for a valid query');
    await expect(prepareBatchContext(corpus, 'bounded source', ['One.md', 'Two.md'])).rejects.toThrow('48000-character combined context limit');
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
