import type {Plan} from './corpus.mjs';
export function safePath(rootPath:string,path:string,mustExist?:boolean):Promise<string>;
export function apply(root:string,plan:Plan,digest:string,transactionPath:string):Promise<{status:string;updated:number}>;
export function rollback(root:string,transaction:unknown):Promise<{status:string;restored:number}>;
