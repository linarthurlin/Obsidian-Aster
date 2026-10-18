export interface Context { schema: number; query: string; target: { path: string; hash: string; text: string }; sources: Array<{path:string;hash:string;excerpt:string;startLine:number;score:number}>; }
export interface Suggestion { status: 'proposal'|'no_change'; reason: string; after: string; sources: Array<{path:string;excerpt:string}>; }
export interface Plan { schema:number; id:string; createdAt:string; operations:Array<{path:string;before:string;after:string;beforeHash:string;afterHash:string;reason:string;sources:Array<{path:string;hash:string;excerpt:string;locator:string}>}>; }
export interface Reviewed { plan:Plan; review:{digest:string;changes:Array<{path:string;reason:string;diff:string;sources:Array<{path:string;excerpt:string;locator:string}>}>}; }
export function visiblePath(path:unknown):boolean;
export function resolveScope(vault:string,folder:string):Promise<string>;
export function listNotes(root:string):Promise<string[]>;
export function prepareContext(root:string,query:string,target:string):Promise<Context>;
export function contextDigest(context:Context):string;
export function assertContextFresh(root:string,context:Context):Promise<void>;
export function suggestionPlan(root:string,context:Context,output:Suggestion):Promise<Reviewed|null>;
