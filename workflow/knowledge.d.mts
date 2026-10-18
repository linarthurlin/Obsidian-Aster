import type {Plan} from './corpus.mjs';
export function safePath(rootPath:string,path:string,mustExist?:boolean):Promise<string>;
export function apply(root:string,plan:Plan,digest:string,transactionPath:string):Promise<{status:string;updated:number}>;
export function rollback(root:string,transaction:unknown):Promise<{status:string;restored:number}>;
export function inspectTransactionJournal(root:string,journalPath:string):Promise<{status:string;digest:string;planId:string;createdAt:string;targets:{path:string;state:'before'|'after'|'conflict'|'missing'}[];recovery?:{action?:string;startedAt?:string;updatedAt?:string;completedAt?:string;restoredCount:number;conflicts:string[]}}>;
export function recoverTransactionJournal(root:string,journalPath:string):Promise<{status:string;restored:number;alreadyBefore:number}>;
export function rollbackTransactionJournal(root:string,journalPath:string):Promise<{status:string;restored:number;alreadyBefore:number}>;
