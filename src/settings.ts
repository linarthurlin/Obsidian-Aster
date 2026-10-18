import { visiblePath } from '../workflow/corpus.mjs';
export interface Settings { corpusFolder:string; executable:string; model:string; }
export function normalizeSettings(raw:unknown):Settings {
  const value=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
  return { corpusFolder:visiblePath(value.corpusFolder)?value.corpusFolder as string:'',
    executable:typeof value.executable==='string'&&value.executable.length<2000&&!/[\u0000\r\n]/.test(value.executable)?value.executable:'',
    model:typeof value.model==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,100}$/.test(value.model)?value.model:'' };
}
