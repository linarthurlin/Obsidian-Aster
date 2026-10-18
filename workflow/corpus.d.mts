export interface Context { schema: number; query: string; target: { path: string; hash: string; text: string }; sources: Array<{path:string;hash:string;excerpt:string;startLine:number;score:number}>; }
export interface BatchContext { schema: 2; query: string; targets: Array<{path:string;hash:string;text:string}>; sources: Array<{path:string;hash:string;excerpt:string;startLine:number;score:number}>; }
export interface CorpusSearchResult { path:string; score:number; excerpt:string; startLine:number; }
export const LIMITS: { files:number; bytes:number; searchBytes:number; searchExcerptChars:number; searchResults:number; targetChars:number; batchTargets:number; batchTargetChars:number; excerptChars:number; sources:number };
export interface Suggestion { status: 'proposal'|'no_change'; reason: string; after: string; sources: Array<{path:string;excerpt:string}>; }
export interface BatchSuggestion { status: 'proposal'|'no_change'; reason: string; operations: Array<{path:string;reason:string;after:string;sources:Array<{path:string;excerpt:string}>}>; }
export interface Plan { schema:number; id:string; createdAt:string; operations:Array<{path:string;before:string;after:string;beforeHash:string;afterHash:string;reason:string;sources:Array<{path:string;hash:string;excerpt:string;locator:string}>}>; }
export interface Reviewed { plan:Plan; review:{digest:string;changes:Array<{path:string;reason:string;diff:string;sources:Array<{path:string;excerpt:string;locator:string}>}>}; }
export function visiblePath(path:unknown):boolean;
export function resolveScope(vault:string,folder:string):Promise<string>;
export function listNotes(root:string):Promise<string[]>;
export function getCorpusBacklinks(folder:string,targetPath:string,notePaths:string[],resolvedLinks:Record<string,Record<string,number>>):string[];
export function searchCorpus(root:string,query:string,limit?:number):Promise<{query:string;scannedFiles:number;scannedBytes:number;truncated:boolean;results:CorpusSearchResult[]}>;
export function prepareContext(root:string,query:string,target:string):Promise<Context>;
export function prepareBatchContext(root:string,query:string,targets:string[]):Promise<BatchContext>;
export function contextDigest(context:Context|BatchContext):string;
export function assertContextFresh(root:string,context:Context|BatchContext):Promise<void>;
export function suggestionPlan(root:string,context:Context,output:Suggestion):Promise<Reviewed|null>;
export function validateBatchSuggestion(context:BatchContext,output:BatchSuggestion):BatchSuggestion;
export function batchSuggestionPlan(root:string,context:BatchContext,output:BatchSuggestion):Promise<Reviewed|null>;
