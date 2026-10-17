import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { connectDemo } from './demo-cdp.mjs';
const demo = await connectDemo();
const digest = text => createHash('sha256').update(text).digest('hex');
const paths = ['Welcome.md', 'Rendering.md', 'Research/Filtering.md', 'Research/Note 2.md', 'Research/Note 10.md', 'Sources/Filter Notes.md'];
const before = await Promise.all(paths.map(async path => digest(await readFile(`demo-vault/${path}`, 'utf8'))));
async function wait(expression) {
  await demo.evaluate(`new Promise((resolve,reject)=>{ const until=Date.now()+10000; const check=()=>{if(${expression})resolve(true);else if(Date.now()>until)reject(new Error('Timed out waiting for ${expression.replaceAll("'", '')}'));else setTimeout(check,50)};check();})`);
}
async function screenshot(name) {
  await demo.evaluate("document.querySelectorAll('.modal-close-button').forEach(button=>button.click()); Array.from(document.querySelectorAll('.modal-container button')).find(button=>button.textContent==='Thanks!')?.click()");
  await wait("!document.querySelector('.modal-container')");
  await demo.evaluate('Promise.all(Array.from(document.images).filter(image=>!/^https?:/.test(image.currentSrc||image.src)).map(image=>image.decode().catch(()=>{})))');
  await demo.evaluate('document.body.getBoundingClientRect().toJSON()');
  const result = await demo.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(`output/obsidian/${name}.png`, Buffer.from(result.data, 'base64'));
}
try {
  await mkdir('output/obsidian', { recursive: true });
  const plugins = await demo.evaluate(`(async()=>{
    if(!app.plugins.isEnabled())await app.plugins.setEnable(true);
    const results=[];
    for(const id of ['personal-glass','notebook-navigator','crisp-craft','tables','advanced-canvas','ninja-cursor']){
      if(!app.plugins.plugins[id])await app.plugins.loadPlugin(id);
      results.push({id,loaded:!!app.plugins.plugins[id],version:app.plugins.manifests[id]?.version});
    }
    document.querySelector('.modal-close-button')?.click();
    return results;
  })()`);
  assert(plugins.every(plugin => plugin.loaded), JSON.stringify(plugins));
  await demo.evaluate(`(()=>{
    const leaf=app.workspace.getLeaf('tab');window.__personalGlassSmokeLeaf=leaf;
    const old=[];app.workspace.iterateAllLeaves(l=>{if(l!==leaf && ['markdown','canvas'].includes(l.view.getViewType()))old.push(l)});
    old.forEach(l=>l.detach());
  })()`);
  await demo.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  const navigation = await demo.evaluate(`(async()=>{
    const p=app.plugins.plugins['personal-glass']; await p.openNavigator();
    const nav=app.workspace.getLeavesOfType('personal-glass-navigator')[0].view;
    nav.showSources=false; nav.refresh();
    const input=nav.contentEl.querySelector('[aria-label="Search navigator"]');
    input.value='狀態估測 #robotics'; input.dispatchEvent(new Event('input',{bubbles:true}));
    const matches=Array.from(nav.contentEl.querySelectorAll('.pg-file')).map(row=>row.dataset.path);
    if(matches.length!==1 || matches[0]!=='Research/Filtering.md')throw new Error('Alias/tag search failed');
    const active=app.workspace.getActiveFile()?.path;
    const first=nav.contentEl.querySelector('.pg-file');first.focus();first.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
    if(app.workspace.getActiveFile()?.path!==active)throw new Error('Focus navigation unexpectedly opened a file');
    p.settings.pinnedPaths=['Research/Filtering.md'];p.settings.navigatorPreviews=true;await p.persist();
    nav.query='';input.value='';nav.navScope='pinned';nav.showSources=false;nav.refresh();
    if(nav.contentEl.querySelectorAll('.pg-file').length!==1)throw new Error('Pin filtering failed');
    nav.navScope='all';nav.refresh();
    return {aliasAndTagSearch:true,focusDoesNotOpen:true,pins:true};
  })()`);
  await wait("document.querySelector('.pg-file-preview')?.textContent.length > 0");
  const leaf = "window.__personalGlassSmokeLeaf";
  await demo.evaluate(`(async()=>{const leaf=${leaf};await leaf.setViewState({type:'markdown',state:{file:'Rendering.md',mode:'preview'}});await app.workspace.revealLeaf(leaf);app.workspace.setActiveLeaf(leaf,{focus:true});})()`);
  await wait("document.querySelector('.markdown-reading-view.crisp-craft-enabled')");
  const craft = await demo.evaluate(`({rounded:getComputedStyle(document.querySelector('.markdown-reading-view.crisp-craft-enabled')).getPropertyValue('--cc-radius-lg').trim(),sourceUntouched:true})`);
  assert.equal(craft.rounded, '16px');
  for (const mode of ['light', 'dark']) {
    await demo.evaluate(`document.body.classList.toggle('theme-light',${mode === 'light'});document.body.classList.toggle('theme-dark',${mode === 'dark'});`);
    await screenshot(`navigator-${mode}`);
  }
  const notebook = await demo.evaluate(`(async()=>{
    await app.plugins.plugins['personal-glass'].openNotebookNavigator();
    const leaf=app.workspace.getLeavesOfType('notebook-navigator')[0];
    if(!leaf)throw new Error('Notebook Navigator view did not open');
    return {view:true,accent:getComputedStyle(document.body).getPropertyValue('--nn-theme-navitem-selected-bg').trim()};
  })()`);
  await screenshot('notebook-navigator-dark');
  await demo.evaluate("app.plugins.plugins['personal-glass'].openNavigator()");
  await demo.evaluate(`(async()=>{const leaf=${leaf};await leaf.setViewState({type:'markdown',state:{file:'Rendering.md',mode:'source'}});await app.workspace.revealLeaf(leaf);app.workspace.setActiveLeaf(leaf,{focus:true});})()`);
  const editing = await demo.evaluate(`({callout:!!document.querySelector('.markdown-source-view .callout'),editor:!!document.querySelector('.cm-editor'),syntax:document.querySelector('.cm-content')?.textContent.includes('Rendering parity')})`);
  assert(editing.editor && editing.syntax);
  await screenshot('live-preview-dark');
  await demo.evaluate(`(async()=>{const leaf=${leaf};await leaf.setViewState({type:'canvas',state:{file:'Workspace.canvas'}});await app.workspace.revealLeaf(leaf);app.workspace.setActiveLeaf(leaf,{focus:true});})()`);
  await wait("app.workspace.activeLeaf?.view.getViewType()==='canvas' && app.workspace.activeLeaf.view.contentEl.querySelectorAll('.canvas-node-container').length===2");
  await screenshot('canvas-dark');
  for (const mode of ['light', 'dark']) {
    await demo.evaluate(`(async()=>{document.body.classList.toggle('theme-light',${mode === 'light'});document.body.classList.toggle('theme-dark',${mode === 'dark'});const leaf=${leaf};await leaf.setViewState({type:'markdown',state:{file:'SVG Examples ${mode === 'light' ? 'Light' : 'Dark'}.md',mode:'preview'}});await app.workspace.revealLeaf(leaf);app.workspace.setActiveLeaf(leaf,{focus:true});})()`);
    await wait("document.querySelectorAll('.markdown-reading-view img').length >= 3");
    await demo.evaluate(`Promise.all(Array.from(document.querySelectorAll('.markdown-reading-view img')).map(i=>i.decode()))`);
    assert(await demo.evaluate(`Array.from(document.querySelectorAll('.markdown-reading-view img')).every(i=>i.naturalWidth>0 && i.getBoundingClientRect().width>100)`), 'SVG embeds collapsed');
    await screenshot(`svg-${mode}`);
  }
  const after = await Promise.all(paths.map(async path => digest(await readFile(`demo-vault/${path}`, 'utf8'))));
  assert.deepEqual(after, before, 'Integration browsing changed fixture notes');
  const result = { plugins, navigation, craft, notebook, editing, fixtureNotesUnchanged: paths.length };
  await writeFile('output/obsidian/integrations.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await demo.evaluate('delete window.__personalGlassSmokeLeaf').catch(()=>{}); demo.close(); }
