import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply, propose, review } from '../workflow/knowledge.mjs';
const require = createRequire(import.meta.url);
it('requires explicit scope loading, context preview and consent; changing query invalidates approval', async () => {
  const home=await mkdtemp(join(tmpdir(),'ka-ui-'));await mkdir(join(home,'Selected'));
  await writeFile(join(home,'Selected/Note.md'),'# Filtering\nHuman text.\n');
  await writeFile(join(home,'Selected/Source.md'),'Bayesian prior combines with observations.');
  await writeFile(join(home,'Selected/Empty.md'),'');
  await mkdir(join(home,'Selected/Research'),{recursive:true});await mkdir(join(home,'Selected/Archive'),{recursive:true});
  await writeFile(join(home,'Selected/Research/Meeting.md'),'Synthetic duplicate title fixture.');
  await writeFile(join(home,'Selected/Archive/Meeting.md'),'Synthetic duplicate title fixture.');
  const dom=new JSDOM('<main></main>'), doc=dom.window.document;let spawned=0;const factories=new Map<string,any>();
  const proto=dom.window.HTMLElement.prototype as any;
  proto.empty=function(){this.replaceChildren()};proto.addClass=function(cls:string){this.classList.add(cls)};
  proto.setText=function(text:string){this.textContent=text};
  proto.createEl=function(tag:string,options:any={}){const el=doc.createElement(tag);if(options.cls)el.className=options.cls;if(options.text)el.textContent=options.text;
    if(options.type)(el as any).type=options.type;if(options.placeholder)(el as any).placeholder=options.placeholder;
    if(options.value!==undefined)(el as any).value=options.value;for(const [key,value]of Object.entries(options.attr||{}))el.setAttribute(key,String(value));this.appendChild(el);return el};
  proto.createDiv=function(options:any){return this.createEl('div',options)};proto.createSpan=function(options:any){return this.createEl('span',options)};
  let vaultBodyReads=0;
  const app={vault:{adapter:{getBasePath:()=>home},getAbstractFileByPath:(path:string)=>new TFile(path,path.endsWith('/Empty.md')?0:24),
    read:async()=>{vaultBodyReads++;throw new Error('Corpus metadata report must not read note bodies')},
    cachedRead:async()=>{vaultBodyReads++;throw new Error('Corpus metadata report must not read note bodies')}},workspace:{detachLeavesOfType:()=>{}},metadataCache:{
    resolvedLinks:{'Selected/Note.md':{'Selected/Source.md':1}},
    unresolvedLinks:{'Selected/Source.md':{'Missing synthetic target':1}},
  }};
  class Plugin {app=app;async loadData(){return {corpusFolder:'Selected',executable:process.execPath}}registerView(id:string,f:any){factories.set(id,f)}addCommand(){}addSettingTab(){}}
  class FuzzySuggestModal {}
  class TFile {path:string;stat:{size:number};constructor(path:string,size:number){this.path=path;this.stat={size}}}
  class TFolder {}
  class ItemView {app=app;contentEl=doc.createElement('div');constructor(){doc.querySelector('main')!.appendChild(this.contentEl)}registerDomEvent(el:any,event:string,fn:any){el.addEventListener(event,fn)}}
  const module={exports:{}};
  runInNewContext(await readFile('dist/plugin/main.js','utf8'),{module,exports:module.exports,process,Buffer,AbortController,setTimeout,clearTimeout,
    require:(name:string)=>name==='obsidian'?{Plugin,ItemView,PluginSettingTab:class{},Setting:class{},FuzzySuggestModal,TFile,TFolder}:name==='node:child_process'?{spawn:()=>{spawned++;throw new Error('NETWORK_NOT_ALLOWED')}}:name==='node:os'?{...require('node:os'),homedir:()=>home}:require(name)});
  const Agent=(module.exports as any).default,plugin=new Agent();await plugin.onload();const view=factories.get('knowledge-agent-workbench')({});await view.onOpen();
  const button=(text:string)=>Array.from(doc.querySelectorAll('button')).find(b=>b.textContent!.includes(text))!;
  const invoke=async(el:any)=>{await el.onclick?.(new dom.window.Event('click'))};
  await invoke(button('Run Corpus link health'));
  expect(doc.body.textContent).toContain('Missing synthetic target');
  expect(doc.body.textContent).toContain('metadata only');
  expect(doc.body.textContent).toContain('does not read note bodies');
  expect(doc.body.textContent).toContain('Repeated note titles');
  expect(doc.body.textContent).toContain('Research/Meeting.md');
  expect(doc.body.textContent).toContain('Archive/Meeting.md');
  expect(doc.body.textContent).toContain('Zero-byte Markdown notes');
  expect(doc.body.textContent).toContain('Empty.md');
  expect(vaultBodyReads).toBe(0);
  expect(spawned).toBe(0);
  expect(doc.querySelector('pre')).toBeNull();expect(spawned).toBe(0);
  await invoke(button('Ask Codex'));expect(spawned).toBe(0);
  await invoke(button('Load scoped notes'));const target=doc.querySelector('select')!;target.value='Note.md';target.dispatchEvent(new dom.window.Event('change'));
  const query=doc.querySelector('input[type=text]') as HTMLInputElement;query.value='Bayesian';query.dispatchEvent(new dom.window.Event('input'));
  await invoke(button('Preview context'));expect(doc.querySelector('pre')?.textContent).toContain('Bayesian prior');
  expect(button('Ask Codex').disabled).toBe(true);await invoke(button('Ask Codex'));expect(spawned).toBe(0);
  const consent=doc.querySelector('input[type=checkbox]') as HTMLInputElement;consent.checked=true;consent.dispatchEvent(new dom.window.Event('change'));
  expect(button('Ask Codex').disabled).toBe(false);
  query.value='Different query';query.dispatchEvent(new dom.window.Event('input'));
  expect(consent.checked).toBe(false);expect(button('Ask Codex').disabled).toBe(true);expect(doc.querySelector('pre')).toBeNull();
  query.value='Bayesian';query.dispatchEvent(new dom.window.Event('input'));await invoke(button('Preview context'));
  consent.checked=true;consent.dispatchEvent(new dom.window.Event('change'));
  await writeFile(join(home,'Selected/Source.md'),'A later edit');await invoke(button('Ask Codex'));
  expect(spawned).toBe(0);expect(doc.body.textContent).toContain('Source changed');
  await writeFile(join(home,'Selected/Source.md'),'Bayesian prior combines with observations.');await invoke(button('Preview context'));
  consent.checked=true;consent.dispatchEvent(new dom.window.Event('change'));await invoke(button('Ask Codex'));
  expect(spawned).toBe(1);expect(doc.body.textContent).toContain('Cannot start Codex CLI');
  await view.onClose();expect(view.contentEl.childElementCount).toBe(0);

  const corpus=join(home,'Selected');
  const original='Synthetic target before-state.\n';
  await writeFile(join(corpus,'History.md'),original);
  await writeFile(join(corpus,'HistorySource.md'),'Synthetic history evidence.');
  const plan=await propose(corpus,[{path:'History.md',after:'Synthetic target before-state.\nSupported addition.\n',reason:'Test persistent history review',sources:[{path:'HistorySource.md',excerpt:'Synthetic history evidence.'}]}]);
  const transactionDirectory=join(home,'.knowledge-agent','transactions');
  await mkdir(transactionDirectory,{recursive:true});
  const receipt=join(transactionDirectory,plan.id+'-synthetic.private.json');
  await apply(corpus,plan,review(plan).digest,receipt);

  const restartedPlugin=new Agent();await restartedPlugin.onload();
  const historyView=factories.get('knowledge-agent-workbench')({});await historyView.onOpen();
  await invoke(button('Transaction history'));
  expect(doc.body.textContent).toContain('applied');
  await invoke(button('Review diffs and status'));
  expect(doc.body.textContent).toContain('Supported addition.');
  expect(doc.body.textContent).toContain('after');
  const rollbackButton=button('Rollback this transaction') as HTMLButtonElement;
  expect(rollbackButton.disabled).toBe(true);
  const historyApproval=doc.querySelector('.pga-transaction-detail input[type=checkbox]') as HTMLInputElement;
  historyApproval.checked=true;historyApproval.dispatchEvent(new dom.window.Event('change'));
  expect(rollbackButton.disabled).toBe(false);
  await invoke(rollbackButton);
  expect(await readFile(join(corpus,'History.md'),'utf8')).toBe(original);
  expect(JSON.parse(await readFile(receipt,'utf8')).status).toBe('rolled-back');
  await historyView.onClose();await rm(home,{recursive:true,force:true});dom.window.close();
});
