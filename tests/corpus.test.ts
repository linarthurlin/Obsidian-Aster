import { it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareContext, contextDigest, assertContextFresh, suggestionPlan, validateSuggestion, resolveScope, listNotes } from '../workflow/corpus.mjs';
import { normalizeSettings } from '../src/settings';
async function fixture() {
  const home=await mkdtemp(join(tmpdir(),'ka-corpus-')),root=join(home,'Selected');await mkdir(root);
  await writeFile(join(root,'Note.md'),'# Filtering\n\nKeep human text.\n');
  await writeFile(join(root,'Source.md'),'# Source\n\nBayesian prior combines with observations.\n');
  await mkdir(join(root,'.hidden'));await writeFile(join(root,'.hidden/Secret.md'),'Bayesian private');
  await writeFile(join(home,'Outside.md'),'Bayesian outside');
  return {home,root};
}
it('requires a visible explicit folder and excludes hidden/linked/outside notes',async()=>{
  const f=await fixture();expect(await resolveScope(f.home,'Selected')).toBe(f.root);
  await expect(resolveScope(f.home,'')).rejects.toThrow('whole-vault');
  await expect(resolveScope(f.home,'../Selected')).rejects.toThrow();
  await symlink(f.root,join(f.home,'Linked'),process.platform==='win32'?'junction':'dir');
  await expect(resolveScope(f.home,'Linked')).rejects.toThrow('symlinks');
  expect(await listNotes(f.root)).toEqual(['Note.md','Source.md']);
});
it('captures exact bounded evidence and rejects changed source/target context',async()=>{
  const f=await fixture(),context=await prepareContext(f.root,'Bayesian','Note.md');
  expect(context.sources.map(s=>s.path)).toEqual(['Source.md']);expect(contextDigest(context)).toHaveLength(64);
  const supported={status:'proposal',reason:'Add source detail',after:context.target.text+'\nBayesian prior. [[Source]]\n',sources:[{path:'Source.md',excerpt:'Bayesian prior combines with observations.'}]};
  const proposal=await suggestionPlan(f.root,context,supported);expect(proposal?.review.changes[0].diff).toContain('+Bayesian');
  expect(await readFile(join(f.root,'Note.md'),'utf8')).toBe(context.target.text);
  await writeFile(join(f.root,'Source.md'),'Changed source');await expect(assertContextFresh(f.root,context)).rejects.toThrow('Source changed');
  await writeFile(join(f.root,'Note.md'),'Human edit');await expect(suggestionPlan(f.root,context,supported)).rejects.toThrow('Target changed');
});
it('rejects fabricated or out-of-scope model citations and accepts a literal no-change',async()=>{
  const f=await fixture(),context=await prepareContext(f.root,'Bayesian','Note.md');
  const response={status:'proposal',reason:'Reason',after:'Replacement',sources:[{path:'../Outside.md',excerpt:'Bayesian outside'}]};
  expect(()=>validateSuggestion(context,response)).toThrow('approved excerpts');
  expect(()=>validateSuggestion(context,{...response,sources:[{path:'Source.md',excerpt:'Invented fact'}]})).toThrow('approved excerpts');
  expect(await suggestionPlan(f.root,context,{status:'no_change',reason:'Insufficient evidence',after:context.target.text,sources:[]})).toBeNull();
  expect(()=>validateSuggestion(context,{status:'no_change',reason:'x',after:'Changed',sources:[]})).toThrow('preserve');
  expect(normalizeSettings({corpusFolder:'.obsidian',model:'--dangerously-bypass-approvals-and-sandbox'})).toMatchObject({corpusFolder:'',model:''});
});
it('fails closed when retrieval is empty or a target exceeds budget',async()=>{
  const f=await fixture();await expect(prepareContext(f.root,'Unrelated','Note.md')).rejects.toThrow('No matching');
  await writeFile(join(f.root,'Note.md'),'x'.repeat(32001));await expect(prepareContext(f.root,'Bayesian','Note.md')).rejects.toThrow('32000');
});
