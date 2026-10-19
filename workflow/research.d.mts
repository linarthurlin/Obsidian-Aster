export interface ResearchSourceInput { path: string; content: string; title?: string; citationKey?: string; author?: string; year?: string; }
export interface ResearchEvidence { id: string; text: string; locator: { heading: string; startLine: number; endLine: number; zotero?: { page?: string; itemKey?: string } }; }
export interface ResearchSource { id: string; path: string; title: string; citationKey?: string; author?: string; year?: string; hash: string; evidence: ResearchEvidence[]; }
export interface ResearchSourceSet { schema: 1; question: string; sources: ResearchSource[]; totalEvidenceChars: number; digest: string; }
export const RESEARCH_LIMITS: Readonly<{ sources: number; sourceBytes: number; totalEvidenceChars: number; evidencePerSource: number; evidenceTotal: number; evidenceChars: number; questionChars: number; draftChars: number }>;
export function buildResearchSourceSet(question: string, inputs: ResearchSourceInput[]): ResearchSourceSet;
export function researchEvidenceIds(sourceSet: ResearchSourceSet): string[];
export function buildResearchDraft(sourceSet: ResearchSourceSet): string;
export function assertResearchSourcesFresh(root: string, sourceSet: ResearchSourceSet): Promise<void>;
export function auditResearchCitations(answer: string, allowedIds: string[]): { cited: string[]; unknown: string[]; missing: boolean };