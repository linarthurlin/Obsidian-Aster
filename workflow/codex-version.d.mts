export interface CodexVersion { major:number; minor:number; patch:number; text:string; }
export const TESTED_CODEX_VERSION:Readonly<{major:number;minor:number}>;
export function parseCodexVersion(output:string):CodexVersion|null;
export function isSupportedCodexVersion(version:CodexVersion|null|undefined):boolean;
export function readCodexVersion(executable?:string,options?:{timeoutMs?:number;spawnProcess?:typeof import('node:child_process').spawn}):Promise<CodexVersion>;
