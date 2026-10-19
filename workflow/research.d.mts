export interface ResearchSourceInput { path: string; content: string; format?: 'markdown' | 'pdf'; sourceHash?: string; pages?: Array<{ pageNumber: number; pageLabel?: string; text: string }>; title?: string; citationKey?: string; author?: string; year?: string; }
export interface ResearchEvidence { id: string; text: string; locator: { heading: string; startLine?: number; endLine?: number; pdf?: { pageNumber: number; pageLabel?: string }; zotero?: { page?: string; itemKey?: string } }; }
export interface ResearchSource { id: string; path: string; format: 'markdown' | 'pdf'; title: string; bibliography: { title?: string; citationKey?: string; author?: string; year?: string }; citationKey?: string; author?: string; year?: string; hash: string; evidence: ResearchEvidence[]; }
export interface ResearchSourceSet { schema: 1; question: string; sources: ResearchSource[]; totalEvidenceChars: number; digest: string; }
export interface ResearchEvidenceDigest { id: string; digest: string; }
export const RESEARCH_LIMITS: Readonly<{ sources: number; sourceBytes: number; sourceFiles: number; sourceEntries: number; pdfBytes: number; pdfPagesPerSource: number; pdfPagesTotal: number; totalEvidenceChars: number; evidencePerSource: number; evidenceTotal: number; evidenceChars: number; questionChars: number; draftChars: number }>;
export function listResearchFiles(root: string): Promise<string[]>;
export function buildResearchSourceSet(question: string, inputs: ResearchSourceInput[]): ResearchSourceSet;
export function researchEvidenceIds(sourceSet: ResearchSourceSet): string[];
export function researchEvidenceDigests(sourceSet: ResearchSourceSet): ResearchEvidenceDigest[];
export function buildResearchBibliography(sourceSet: ResearchSourceSet): string;
export function buildResearchDraft(sourceSet: ResearchSourceSet): string;
export function assertResearchSourcesFresh(root: string, sourceSet: ResearchSourceSet): Promise<void>;
export function auditResearchCitations(answer: string, allowedIds: string[]): { cited: string[]; unknown: string[]; missing: boolean };
export function buildResearchReviewDraft(answer: string, evidenceDraft: string, evidenceDigests: ResearchEvidenceDigest[]): string;
export interface ResearchQuoteCheck { text: string; evidenceIds: string[]; matchedIds: string[]; status: 'matched' | 'empty' | 'too-short' | 'too-long' | 'uncited' | 'unknown-citation' | 'snapshot-unavailable' | 'not-found'; }
export function auditResearchQuotes(answer: string, evidenceDraft: string, evidenceDigests: ResearchEvidenceDigest[], allowedIds: string[]): { quotes: ResearchQuoteCheck[]; snapshotIssues: string[]; truncated: boolean };
