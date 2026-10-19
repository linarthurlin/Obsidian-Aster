export interface ModelChoice { id:string; label:string; reasoningEfforts:string[]; isDefault:boolean; }
export function normalizeModelCatalog(response:unknown):ModelChoice[];
export function listCodexModels(executable?:string,options?:{timeoutMs?:number}):Promise<ModelChoice[]>;
