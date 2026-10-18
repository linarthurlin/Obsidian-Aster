export interface AsterSkill { name: string; description: string; instructions: string; }
export function defaultSkillStoreRoot(): string;
export function parseSkillDocument(document: string, expectedName?: string): AsterSkill;
export function serializeSkill(skill: AsterSkill): string;
export function listAsterSkills(root: string): Promise<AsterSkill[]>;
export function saveAsterSkill(root: string, skill: AsterSkill, options?: { overwrite?: boolean }): Promise<AsterSkill>;
export function deleteAsterSkill(root: string, name: string): Promise<boolean>;
