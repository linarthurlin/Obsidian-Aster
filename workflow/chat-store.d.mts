export interface StoredChatMessage { id:string; role:'user'|'assistant'; content:string; createdAt:number; }
export function defaultChatStoreRoot():string;
export function loadChatHistory(root:string,id:string):Promise<StoredChatMessage[]>;
export function saveChatHistory(root:string,id:string,messages:StoredChatMessage[]):Promise<void>;
export function deleteChatHistory(root:string,id:string):Promise<boolean>;
