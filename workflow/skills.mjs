import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { lstat, mkdir, readFile, readdir, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SKILLS = 40;
const MAX_SKILL_BYTES = 100_000;
const MAX_INSTRUCTIONS = 24_000;

export const defaultSkillStoreRoot = () => join(homedir(), '.aster', 'skills');

async function ensureDirectory(path, create) {
  try {
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Aster Skill store path is not a plain local directory.');
    return true;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    if (!create) return false;
    await mkdir(path, { mode: 0o700 });
    return true;
  }
}

function validateName(name) {
  if (typeof name !== 'string' || name.length < 1 || name.length > 64 || !SKILL_NAME.test(name) || name.includes('--')) {
    throw new Error('Skill name must use 1–64 lowercase letters, numbers, and single hyphens.');
  }
}

function parseScalar(value, field) {
  const text = value.trim();
  if (!text) throw new Error(`Skill ${field} is missing.`);
  if (text.startsWith('"')) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'string') throw new Error();
      return parsed;
    } catch { throw new Error(`Skill ${field} must be a valid YAML string.`); }
  }
  if (text.startsWith("'")) {
    if (!text.endsWith("'") || text.length < 2) throw new Error(`Skill ${field} must be a valid YAML string.`);
    return text.slice(1, -1).replace(/''/g, "'");
  }
  return text;
}

export function parseSkillDocument(document, expectedName = '') {
  if (typeof document !== 'string' || Buffer.byteLength(document, 'utf8') > MAX_SKILL_BYTES) throw new Error('SKILL.md exceeds Aster’s 100 KB limit.');
  const normalized = document.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('SKILL.md must start with YAML frontmatter and a blank line after the closing --- delimiter.');
  const fields = new Map();
  for (const line of match[1].split('\n')) {
    const field = line.match(/^(name|description):\s*(.*)$/);
    if (!field) continue;
    if (fields.has(field[1])) throw new Error(`Skill ${field[1]} appears more than once.`);
    fields.set(field[1], parseScalar(field[2], field[1]));
  }
  const name = fields.get('name');
  const description = fields.get('description');
  validateName(name);
  if (expectedName && name !== expectedName) throw new Error('Skill name must match its folder name.');
  if (typeof description !== 'string' || !description.trim() || description.length > 1024 || /\u0000/.test(description)) {
    throw new Error('Skill description must contain 1–1,024 characters.');
  }
  const instructions = match[2].trim();
  if (!instructions || instructions.length > MAX_INSTRUCTIONS || /\u0000/.test(instructions)) {
    throw new Error('Skill instructions must contain 1–24,000 characters.');
  }
  return { name, description: description.trim(), instructions };
}

export function serializeSkill(skill) {
  if (!skill || typeof skill !== 'object') throw new Error('Skill details are invalid.');
  const name = skill.name;
  const description = typeof skill.description === 'string' ? skill.description.trim() : '';
  const instructions = typeof skill.instructions === 'string' ? skill.instructions.trim() : '';
  validateName(name);
  if (!description || description.length > 1024 || /\u0000/.test(description)) throw new Error('Skill description must contain 1–1,024 characters.');
  if (!instructions || instructions.length > MAX_INSTRUCTIONS || /\u0000/.test(instructions)) throw new Error('Skill instructions must contain 1–24,000 characters.');
  const document = `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n\n${instructions}\n`;
  if (Buffer.byteLength(document, 'utf8') > MAX_SKILL_BYTES) throw new Error('SKILL.md exceeds Aster’s 100 KB limit.');
  return document;
}

export async function listAsterSkills(root) {
  if (!await ensureDirectory(dirname(root), false) || !await ensureDirectory(root, false)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const skills = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error('Aster Skill store contains a symbolic link; remove it before loading Skills.');
    if (!entry.isDirectory() || !SKILL_NAME.test(entry.name) || entry.name.includes('--')) continue;
    const directory = join(root, entry.name);
    await ensureDirectory(directory, false);
    const path = join(directory, 'SKILL.md');
    let stat;
    try { stat = await lstat(path); }
    catch (error) { if (error?.code === 'ENOENT') continue; throw error; }
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Skill ${entry.name} SKILL.md is not a plain file.`);
    if (stat.size > MAX_SKILL_BYTES) throw new Error(`Skill ${entry.name} SKILL.md exceeds Aster’s 100 KB limit.`);
    skills.push(parseSkillDocument(await readFile(path, 'utf8'), entry.name));
    if (skills.length > MAX_SKILLS) throw new Error(`Aster keeps at most ${MAX_SKILLS} Skills.`);
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveAsterSkill(root, skill, { overwrite = false } = {}) {
  const document = serializeSkill(skill);
  await ensureDirectory(dirname(root), true);
  await ensureDirectory(root, true);
  const directory = join(root, skill.name);
  try { await mkdir(directory, { mode: 0o700 }); }
  catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    await ensureDirectory(directory, false);
    if (!overwrite) throw new Error(`Skill ${skill.name} already exists.`);
  }
  const path = join(directory, 'SKILL.md');
  try {
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Skill SKILL.md is not a plain file.');
    if (!overwrite) throw new Error(`Skill ${skill.name} already exists.`);
  } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const temporary = join(directory, `.aster-skill-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, document, { flag: 'wx', mode: 0o600 });
    await rename(temporary, path);
  } finally { await unlink(temporary).catch(() => {}); }
  return parseSkillDocument(document, skill.name);
}

export async function deleteAsterSkill(root, name) {
  validateName(name);
  if (!await ensureDirectory(dirname(root), false) || !await ensureDirectory(root, false)) return false;
  const directory = join(root, name);
  if (!await ensureDirectory(directory, false)) return false;
  const path = join(directory, 'SKILL.md');
  let stat;
  try { stat = await lstat(path); }
  catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Skill SKILL.md is not a plain file.');
  await unlink(path);
  await rmdir(directory).catch(error => { if (error?.code !== 'ENOTEMPTY' && error?.code !== 'EEXIST') throw error; });
  return true;
}
