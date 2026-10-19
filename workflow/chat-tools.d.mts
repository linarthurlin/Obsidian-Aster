export const CHAT_CORPUS_TOOLS: ReadonlyArray<{
  name: string;
  description: string;
  strict: true;
  inputSchema: Record<string, unknown>;
}>;
export function dispatchChatCorpusTool(root:string,name:string,args:unknown):Promise<string>;
