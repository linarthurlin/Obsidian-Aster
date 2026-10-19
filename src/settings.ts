import { visiblePath } from '../workflow/corpus.mjs';

export type ChatRole = 'user' | 'assistant';
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}
export interface AgentProject {
  id: string;
  name: string;
  instructions: string;
  createdAt: number;
  updatedAt: number;
}
export interface ChatThread {
  id: string;
  providerThreadId?: string;
  projectId?: string;
  projectName?: string;
  projectInstructions?: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  thinking: string;
  corpusToolsEnabled?: boolean;
  corpusToolsProvisioned?: boolean;
  researchEvidenceIds?: string[];
  researchEvidenceDigests?: Array<{ id: string; digest: string }>;
  researchReview?: boolean;
}
export interface Settings {
  corpusFolder: string;
  executable: string;
  model: string;
  thinking: string;
  projects: AgentProject[];
  activeProjectId: string;
  chats: ChatThread[];
  activeChatId: string;
}

const EFFORTS = new Set(['', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
const safeText = (value: unknown, limit: number) => typeof value === 'string' && value.length <= limit && !/\u0000/.test(value) ? value : '';
const safeId = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : '';
function normalizeProjects(raw: unknown): AgentProject[] {
  if (!Array.isArray(raw)) return [];
  const projects: AgentProject[] = [], seen = new Set<string>();
  for (const entry of raw.slice(0, 40)) {
    if (!entry || typeof entry !== 'object') continue;
    const value = entry as Record<string, unknown>, id = safeId(value.id);
    const name = safeText(value.name, 80).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const createdAt = Number(value.createdAt), updatedAt = Number(value.updatedAt);
    projects.push({ id, name, instructions: safeText(value.instructions, 6000),
      createdAt: Number.isFinite(createdAt) ? createdAt : 0, updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0 });
  }
  return projects;
}
function normalizeChats(raw: unknown): ChatThread[] {
  if (!Array.isArray(raw)) return [];
  const chats: ChatThread[] = [];
  for (const entry of raw.slice(0, 24)) {
    if (!entry || typeof entry !== 'object') continue;
    const value = entry as Record<string, unknown>;
    const id = safeId(value.id);
    if (!id) continue;
    const createdAt = Number(value.createdAt);
    const updatedAt = Number(value.updatedAt);
    const thinking = safeText(value.thinking, 20);
    const providerThreadId = safeText(value.providerThreadId, 200);
    const projectId = safeId(value.projectId);
    const projectName = safeText(value.projectName, 80).trim();
    const projectInstructions = safeText(value.projectInstructions, 6000);
    const researchEvidenceIds = Array.isArray(value.researchEvidenceIds)
      ? [...new Set(value.researchEvidenceIds.filter((id): id is string => typeof id === 'string' && /^S\d+-E\d+$/.test(id)))].slice(0, 120)
      : [];
    const selectedEvidence = new Set(researchEvidenceIds), digestIds = new Set<string>();
    const researchEvidenceDigests = Array.isArray(value.researchEvidenceDigests)
      ? value.researchEvidenceDigests.slice(0, 120).flatMap(entry => {
        if (!entry || typeof entry !== 'object') return [];
        const digest = entry as Record<string, unknown>;
        if (typeof digest.id !== 'string' || !selectedEvidence.has(digest.id) || digestIds.has(digest.id)
          || typeof digest.digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest.digest)) return [];
        digestIds.add(digest.id);
        return [{ id: digest.id, digest: digest.digest }];
      })
      : [];
    chats.push({
      id,
      ...(providerThreadId && /^[a-zA-Z0-9_-]{1,200}$/.test(providerThreadId) ? { providerThreadId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(projectName ? { projectName } : {}),
      ...(projectInstructions ? { projectInstructions } : {}),
      title: safeText(value.title, 100) || 'New chat',
      createdAt: Number.isFinite(createdAt) ? createdAt : 0,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
      model: safeText(value.model, 120),
      thinking: EFFORTS.has(thinking) ? thinking : '',
      corpusToolsEnabled: value.corpusToolsEnabled === true,
      corpusToolsProvisioned: value.corpusToolsProvisioned === true,
      ...(researchEvidenceIds.length ? { researchEvidenceIds } : {}),
      ...(researchEvidenceDigests.length ? { researchEvidenceDigests } : {}),
      ...(value.researchReview === true ? { researchReview: true } : {}),
    });
  }
  return chats;
}

export function normalizeSettings(raw: unknown): Settings {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const projects = normalizeProjects(value.projects);
  const chats = normalizeChats(value.chats);
  const requestedActive = safeId(value.activeChatId);
  const requestedProject = safeId(value.activeProjectId);
  return {
    corpusFolder: visiblePath(value.corpusFolder) ? value.corpusFolder as string : '',
    executable: typeof value.executable === 'string' && value.executable.length < 2000 && !/[\u0000\r\n]/.test(value.executable) ? value.executable : '',
    model: typeof value.model === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,100}$/.test(value.model) ? value.model : '',
    thinking: EFFORTS.has(safeText(value.thinking, 20)) ? safeText(value.thinking, 20) : '',
    projects,
    activeProjectId: projects.some(project => project.id === requestedProject) ? requestedProject : '',
    chats,
    activeChatId: chats.some(chat => chat.id === requestedActive) ? requestedActive : (chats[0]?.id ?? ''),
  };
}
