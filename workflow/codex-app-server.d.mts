export interface ThreadUsage { activeTokens:number; cumulativeTokens:number|null; contextWindow:number|null; usedPercent:number|null; }
export interface ConversationMessage { role:'user'|'assistant'; content:string; }
export function buildAppServerArgs():string[];
export function normalizeThreadUsage(value:unknown):ThreadUsage|null;
export function restoredConversationPrompt(messages:ConversationMessage[]):string;
export interface AppServerTurnResult { answer:string; usage:ThreadUsage|null; status:'completed'; turnId:string; }
export interface AppServerClientOptions { executable?:string; timeoutMs?:number; spawnProcess?:typeof import('node:child_process').spawn; readVersion?:(executable:string)=>Promise<unknown>; }
export class CodexAppServerClient {
  constructor(options?:AppServerClientOptions);
  readonly version:unknown;
  readonly serverInfo:unknown;
  readonly isReady:boolean;
  start():Promise<this>;
  startThread(options?:{model?:string;title?:string;projectInstructions?:string}):Promise<string>;
  resumeThread(threadId:string,projectInstructions?:string):Promise<string>;
  setThreadName(threadId:string,title:string):Promise<void>;
  runTurn(options:{threadId:string;conversation:ConversationMessage[];model?:string;effort?:string;signal?:AbortSignal;onDelta?:(delta:string,fullText:string)=>void;onUsage?:(usage:ThreadUsage)=>void;onCompaction?:()=>void}):Promise<AppServerTurnResult>;
  close():Promise<void>;
}
