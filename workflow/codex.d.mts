import type {Context,Suggestion} from './corpus.mjs';
export function defaultExecutable():Promise<string>;
export function buildArgs(directory:string,schema:string,output:string,model?:string,effort?:string):string[];
export function runCodex(context:Context,options:{approvedDigest:string;executable?:string;model?:string;effort?:string;timeoutMs?:number;signal?:AbortSignal}):Promise<Suggestion>;
export function runChatTurn(messages:Array<{role:'user'|'assistant';content:string}>,options?:{executable?:string;model?:string;effort?:string;timeoutMs?:number;signal?:AbortSignal;onStdoutLine?:(line:string)=>void}):Promise<string>;
export function chatPrompt(messages:Array<{role:'user'|'assistant';content:string}>):string;
