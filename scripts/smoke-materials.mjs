// Run only against the isolated demo profile; CSS emulation is not an OS visual test.
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { connectDemo } from './demo-cdp.mjs';
const demo = await connectDemo();
let settings;
try {
  settings = await demo.evaluate("({...app.plugins.plugins['personal-glass'].settings})");
  const matrix = await demo.evaluate(`(async()=>{
    const p=app.plugins.plugins['personal-glass'], rows=[];
    for(const mode of ['light','dark']) for(const palette of ['warm','mineral','rose']) for(const material of ['none','mica','acrylic','tabbed']){
      document.body.classList.toggle('theme-light',mode==='light');document.body.classList.toggle('theme-dark',mode==='dark');
      p.settings={...p.settings,palette,material};p.applyAll();
      rows.push({mode,palette,material,status:p.nativeStatus,native:document.body.dataset.personalNative,accent:getComputedStyle(document.body).getPropertyValue('--personal-accent').trim()});
    }
    return rows;
  })()`);
  assert.equal(matrix.length,24);
  assert(matrix.every(row=>row.accent && row.native===(row.material==='none'?'off':'active')), 'Native API matrix failed');
  const sizes=[];
  for(const width of [900,1440]) {
    await demo.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    sizes.push(await demo.evaluate(`({width:innerWidth,overflow:document.body.scrollWidth>innerWidth})`));
  }
  assert(sizes.every(size=>!size.overflow));
  const fallbacks=[];
  for(const [name,property,expected] of [['prefers-reduced-motion','--personal-duration','0ms'],['prefers-reduced-transparency','--personal-panel-alpha','100%']]) {
    await demo.send('Emulation.setEmulatedMedia',{features:[{name,value:'reduce'}]});
    const actual=await demo.evaluate(`getComputedStyle(document.body).getPropertyValue('${property}').trim()`);
    assert.equal(actual,expected);fallbacks.push({feature:name,actual});
  }
  await demo.send('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]});
  const forced=await demo.evaluate(`({active:matchMedia('(forced-colors: active)').matches,blur:getComputedStyle(document.querySelector('.workspace-leaf-content')).backdropFilter})`);
  assert(forced.active && forced.blur==='none');
  await demo.send('Emulation.setEmulatedMedia',{features:[]});
  const popout=await demo.evaluate(`(async()=>{
    const p=app.plugins.plugins['personal-glass'];p.settings.material='acrylic';
    const leaf=app.workspace.openPopoutLeaf({size:{width:800,height:700}});
    try {
      await leaf.setViewState({type:'markdown',state:{file:'Rendering.md',mode:'preview'}});
      p.applyAll();const doc=leaf.view.containerEl.ownerDocument;
      if(doc===document)throw new Error('Popout used main document');
      const mainId=p.getNativeWindow(document)?.id, popoutId=p.getNativeWindow(doc)?.id;
      if(popoutId!==undefined && popoutId===mainId)throw new Error('Popout native API resolved to main window');
      return {separateDocument:true,palette:doc.body.dataset.personalPalette,native:doc.body.dataset.personalNative,distinctNativeWindow:popoutId!==undefined && popoutId!==mainId,mainStatus:p.nativeStatus};
    } finally {leaf.detach();}
  })()`);
  assert(popout.separateDocument && popout.palette==='rose');
  const environment=await demo.evaluate(`({title:document.title,userAgent:navigator.userAgent})`);
  const result={environment,matrix,sizes,cssEmulatedFallbacks:fallbacks,forced,popout,limitations:'Native API acceptance is not proof of desktop blur. Real wallpaper/focus/OS transparency/multi-monitor and daily-use tests remain manual.'};
  await mkdir('output/obsidian',{recursive:true});
  await writeFile('output/obsidian/materials.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{
  await demo.send('Emulation.setEmulatedMedia',{features:[]}).catch(()=>{});
  if(settings)await demo.evaluate(`app.plugins.plugins['personal-glass'].settings=${JSON.stringify(settings)};app.plugins.plugins['personal-glass'].applyAll()`);
  demo.close();
}
