import { it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, symlink, realpath, stat, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareContext, searchCorpus, invalidateCorpusSearchIndex, getCorpusBacklinks, contextDigest, assertContextFresh, suggestionPlan, validateSuggestion, resolveScope, listNotes } from '../workflow/corpus.mjs';
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
  const f=await fixture();expect(await resolveScope(f.home,'Selected')).toBe(await realpath(f.root));
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
it('searches only visible Corpus notes and returns bounded excerpts for navigation',async()=>{
  const f=await fixture();
  await writeFile(join(f.root,'Second.md'),'# Bayesian source\n\nA second synthetic matching result.\n');
  const result=await searchCorpus(f.root,'Bayesian',1);
  expect(result.scannedFiles).toBe(3);
  expect(result.results).toHaveLength(1);
  expect(result.truncated).toBe(true);
  expect(result.results[0].excerpt.length).toBeLessThanOrEqual(420);
  expect(result.results[0].path).not.toContain('Secret');
  expect(result.results[0].path).not.toContain('Outside');
  await expect(searchCorpus(f.root,'')).rejects.toThrow('search query');
  await expect(searchCorpus(f.root,'Bayesian',51)).rejects.toThrow('between 1 and 50');
});
it('reuses one explicit in-memory search index and rebuilds when file metadata changes',async()=>{
  const f=await fixture();invalidateCorpusSearchIndex();
  const realNow=Date.now;let now=realNow();Date.now=()=>now;
  try {
    const first=await searchCorpus(f.root,'Bayesian');
    const second=await searchCorpus(f.root,'Bayesian');
    expect(first.cacheHit).toBe(false);expect(first.scannedBytes).toBeGreaterThan(0);expect(first.indexedBytes).toBe(first.scannedBytes);
    expect(second.cacheHit).toBe(true);expect(second.scannedBytes).toBe(0);expect(second.indexedBytes).toBe(first.indexedBytes);
    expect(second.results).toEqual(first.results);

    const alternate=join(f.home,'Alternate');await mkdir(alternate);await writeFile(join(alternate,'Other.md'),'Bayesian notes in another selected scope.');
    expect((await searchCorpus(alternate,'Bayesian')).cacheHit).toBe(false);
    expect((await searchCorpus(f.root,'Bayesian')).cacheHit).toBe(false);

    const source=join(f.root,'Source.md'),before=await stat(source),nextTime=new Date(before.mtimeMs+10_000);
    await writeFile(source,'# Source\n\nCatalyst prior combines with observations.\n');
    await utimes(source,nextTime,nextTime);
    now+=15_001;
    const rebuilt=await searchCorpus(f.root,'Bayesian');
    expect(rebuilt.cacheHit).toBe(false);expect(rebuilt.scannedBytes).toBeGreaterThan(0);expect(rebuilt.results).toHaveLength(0);
  } finally { Date.now=realNow;invalidateCorpusSearchIndex();await rm(f.home,{recursive:true,force:true}); }
});
it('returns only resolved backlink sources that are members of the selected Corpus',async()=>{
  const resolvedLinks={
    'ResearchScope/Linker.md':{'ResearchScope/Target.md':1},
    'Elsewhere/External.md':{'ResearchScope/Target.md':2},
    'ResearchScope/Unlisted.md':{'ResearchScope/Target.md':1},
  };
  expect(getCorpusBacklinks('ResearchScope','Target.md',['Target.md','Linker.md'],resolvedLinks)).toEqual(['Linker.md']);
  expect(getCorpusBacklinks('ResearchScope','Target.md',['Target.md'],{})).toEqual([]);
  expect(() => getCorpusBacklinks('ResearchScope','../Target.md',['Target.md'],resolvedLinks)).toThrow('visible Corpus note');
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
