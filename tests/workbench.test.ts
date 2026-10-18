import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { readFile, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
it('requires explicit scope loading, context preview and consent; changing query invalidates approval', async () => {
  const home=await mkdtemp(join(tmpdir(),'ka-ui-'));await mkdir(join(home,'Selected'));
  await writeFile(join(home,'Selected/Note.md'),'# Filtering\nHuman text.\n');
  await writeFile(join(home,'Selected/Source.md'),'Bayesian prior combines with observations.');
  const dom=new JSDOM('<main></main>'), doc=dom.window.document;let spawned=0;const factories=new Map<string,any>();
  const proto=dom.window.HTMLElement.prototype as any;
  proto.empty=function(){this.replaceChildren()};proto.addClass=function(cls:string){this.classList.add(cls)};
  proto.setText=function(text:string){this.textContent=text};
  proto.createEl=function(tag:string,options:any={}){const el=doc.createElement(tag);if(options.cls)el.className=options.cls;if(options.text)el.textContent=options.text;
    if(options.type)(el as any).type=options.type;if(options.placeholder)(el as any).placeholder=options.placeholder;
    if(options.value!==undefined)(el as any).value=options.value;for(const [key,value]of Object.entries(options.attr||{}))el.setAttribute(key,String(value));this.appendChild(el);return el};
  proto.createDiv=function(options:any){return this.createEl('div',options)};proto.createSpan=function(options:any){return this.createEl('span',options)};
  const app={vault:{adapter:{getBasePath:()=>home}},workspace:{detachLeavesOfType:()=>{}}};
  class Plugin {app=app;async loadData(){return {corpusFolder:'Selected',executable:process.execPath}}registerView(id:string,f:any){factories.set(id,f)}addCommand(){}addSettingTab(){}}
  class ItemView {app=app;contentEl=doc.createElement('div');constructor(){doc.querySelector('main')!.appendChild(this.contentEl)}registerDomEvent(el:any,event:string,fn:any){el.addEventListener(event,fn)}}
  const module={exports:{}};
  runInNewContext(await readFile('dist/plugin/main.js','utf8'),{module,exports:module.exports,process,Buffer,AbortController,setTimeout,clearTimeout,
    require:(name:string)=>name==='obsidian'?{Plugin,ItemView,PluginSettingTab:class{}}:name==='node:child_process'?{spawn:()=>{spawned++;throw new Error('NETWORK_NOT_ALLOWED')}}:require(name)});
  const Agent=(module.exports as any).default,plugin=new Agent();await plugin.onload();const view=factories.get('knowledge-agent-workbench')({});await view.onOpen();
  const button=(text:string)=>Array.from(doc.querySelectorAll('button')).find(b=>b.textContent!.includes(text))!;
  const invoke=async(el:any)=>{await el.onclick?.(new dom.window.Event('click'))};
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
  await view.onClose();expect(view.contentEl.childElementCount).toBe(0);dom.window.close();
});
