import type {Context,Suggestion} from './corpus.mjs';
export function defaultExecutable():Promise<string>;
export function runCodex(context:Context,options:{approvedDigest:string;executable?:string;model?:string;timeoutMs?:number;signal?:AbortSignal}):Promise<Suggestion>;
