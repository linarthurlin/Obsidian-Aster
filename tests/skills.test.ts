import { expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deleteAsterSkill, listAsterSkills, parseSkillDocument, saveAsterSkill, serializeSkill } from '../workflow/skills.mjs';

async function withSkillRoot(run: (root: string) => Promise<void>) {
  const home = await mkdtemp(join(tmpdir(), 'aster-skills-test-'));
  const root = join(home, '.aster', 'skills');
  try { await run(root); }
  finally { await rm(home, { recursive: true, force: true }); }
}

it('round-trips a standard SKILL.md file in a stable, name-matched local directory', async () => withSkillRoot(async root => {
  const skill = { name: 'meeting-review', description: 'Extract decisions: owners, follow-ups, and risks.', instructions: '1. List decisions.\n2. Name each owner.' };
  await saveAsterSkill(root, skill);
  const path = join(root, skill.name, 'SKILL.md');
  const document = await readFile(path, 'utf8');
  expect(document).toContain('name: meeting-review');
  expect(document).toContain('description: "Extract decisions: owners, follow-ups, and risks."');
  expect(await listAsterSkills(root)).toEqual([skill]);
  await expect(saveAsterSkill(root, skill)).rejects.toThrow('already exists');
  await saveAsterSkill(root, { ...skill, instructions: 'Updated instructions.' }, { overwrite: true });
  expect((await listAsterSkills(root))[0].instructions).toBe('Updated instructions.');
}));

it('validates names, required frontmatter, folder identity, and instruction size', async () => withSkillRoot(async root => {
  expect(() => serializeSkill({ name: '../outside', description: 'x', instructions: 'y' })).toThrow('Skill name');
  expect(() => parseSkillDocument('No frontmatter')).toThrow('YAML frontmatter');
  const mismatch = serializeSkill({ name: 'valid-skill', description: 'Valid skill.', instructions: 'Do the task.' });
  await mkdir(join(root, 'other-name'), { recursive: true });
  await writeFile(join(root, 'other-name', 'SKILL.md'), mismatch, 'utf8');
  await expect(listAsterSkills(root)).rejects.toThrow('match its folder name');
  expect(() => serializeSkill({ name: 'valid-skill', description: 'Valid skill.', instructions: 'x'.repeat(24_001) })).toThrow('24,000 characters');
}));

it('deletes only SKILL.md and preserves user-added references in that skill directory', async () => withSkillRoot(async root => {
  await saveAsterSkill(root, { name: 'source-review', description: 'Review a source.', instructions: 'Extract claims.' });
  const references = join(root, 'source-review', 'references');
  await mkdir(references);
  await writeFile(join(references, 'guide.md'), 'keep this resource', 'utf8');
  expect(await deleteAsterSkill(root, 'source-review')).toBe(true);
  expect(await readFile(join(references, 'guide.md'), 'utf8')).toBe('keep this resource');
  expect(await listAsterSkills(root)).toEqual([]);
  expect(await deleteAsterSkill(root, 'source-review')).toBe(false);
}));
