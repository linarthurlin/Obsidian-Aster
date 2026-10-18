import { it, expect } from 'vitest';
import { mkdtemp, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildArgs, execute, runCodex, modelPrompt } from '../workflow/codex.mjs';
import { contextDigest } from '../workflow/corpus.mjs';
const context={schema:1,query:'Bayesian',target:{path:'Note.md',hash:'unused',text:'Original'},sources:[{path:'Source.md',hash:'unused',excerpt:'Exact evidence.',startLine:1,score:2}]};
it('uses direct process arguments, a separate cwd, readonly sandbox and disabled tool features',()=>{
  const args=buildArgs('/isolated','/schema.json','/result.json');
  expect(args).toContain('read-only');expect(args).toContain('--ignore-user-config');expect(args).toContain('--ephemeral');
  expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox');expect(args).not.toContain('--add-dir');
  expect(args).toContain('shell_tool');expect(args).toContain('plugins');expect(args).toContain('web_search="disabled"');
  expect(()=>buildArgs('/x','/s','/o','--bad')).toThrow();
  expect(modelPrompt(context)).toContain('untrusted data');
});
it('requires exact context approval before spawning and refuses shell wrappers',async()=>{
  await expect(runCodex(context,{approvedDigest:'wrong'})).rejects.toThrow('Approve');
  expect(()=>execute('codex.cmd',[],'')).toThrow('shell wrapper');
});
it('handles subprocess failure, cancellation, timeout and stdout limits without shell interpolation',async()=>{
  const home=await mkdtemp(join(tmpdir(),'ka-provider-')),file=join(home,'fake.mjs');
  await writeFile(file,"const data=[];for await(const chunk of process.stdin)data.push(chunk);console.log(Buffer.concat(data).toString())");
  const output=await execute(process.execPath,[file],'literal $(private); & |',{cwd:home});expect(output.stdout.trim()).toBe('literal $(private); & |');
  await writeFile(file,'process.exit(7)');await expect(execute(process.execPath,[file],'',{cwd:home})).rejects.toThrow('exit 7');
  await writeFile(file,'setInterval(()=>{},1000)');await expect(execute(process.execPath,[file],'',{cwd:home,timeoutMs:100})).rejects.toThrow('timed out');
  const abort=new AbortController();const pending=execute(process.execPath,[file],'',{cwd:home,signal:abort.signal});abort.abort();await expect(pending).rejects.toThrow('cancelled');
  await writeFile(file,"console.log('x'.repeat(2100000))");await expect(execute(process.execPath,[file],'',{cwd:home})).rejects.toThrow('2MB');
});
