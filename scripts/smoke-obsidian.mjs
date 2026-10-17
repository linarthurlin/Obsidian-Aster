// Development-only smoke test. Refuses to operate on any vault except this repo's synthetic demo.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const targets = await (await fetch('http://127.0.0.1:9237/json/list')).json();
const target = targets.find(t => t.type === 'page' && t.url === 'app://obsidian.md/index.html' && t.title.includes('demo-vault'));
assert(target, 'Start an isolated Obsidian development profile on port 9237 first');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok, reject) => { socket.addEventListener('open', ok, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const request = pending.get(message.id);
  if (!request) return;
  clearTimeout(request.timeout); pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message)); else request.ok(message.result);
});
function send(method, params = {}) {
  return new Promise((ok, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 20000);
    pending.set(id, { ok, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
try {
  const expected = resolve('demo-vault').replaceAll('\\', '/');
  const actual = await evaluate("app.vault.adapter.getBasePath().replaceAll('\\\\', '/')");
  assert.equal(actual.toLowerCase(), expected.toLowerCase(), 'Refusing a non-demo vault');
  const result = await evaluate(`(async () => {
    if (!app.plugins.isEnabled()) await app.plugins.setEnable(true);
    if (app.plugins.plugins['personal-glass']) await app.plugins.disablePlugin('personal-glass');
    if (!app.plugins.plugins['personal-glass']) await app.plugins.loadPlugin('personal-glass');
    const p = app.plugins.plugins['personal-glass'];
    if (!p) throw new Error('Companion plugin did not load');
    const ids = Object.keys(app.commands.commands).filter(id => id.startsWith('personal-glass:'));
    if (ids.length !== 17) throw new Error('Expected 14 insertion commands plus surface and navigator commands');
    document.querySelector('.modal-close-button')?.click();
    app.vault.setConfig('showInlineTitle', false);
    app.vault.setConfig('propertiesInDocument', 'hidden');
    const leaf = app.workspace.getLeaf(false);
    await leaf.setViewState({type:'markdown',state:{file:'Welcome.md',mode:'source'}});
    const editor = leaf.view.editor;
    const original = editor.getValue();
    try {
      editor.setValue('第一行\\n第二行');
      editor.setSelection({line:0,ch:0},{line:1,ch:3});
      app.commands.executeCommandById('personal-glass:callout-note');
      if (editor.getValue() !== '> [!note]\\n> 第一行\\n> 第二行') throw new Error('Runtime callout insertion failed');
      editor.undo();
      if (editor.getValue() !== '第一行\\n第二行') throw new Error('Runtime undo failed');
    } finally { editor.setValue(original); }
    await leaf.setViewState({type:'markdown',state:{file:'Welcome.md',mode:'preview'}});
    const settings = {...p.settings};
    const palettes = [];
    for (const palette of ['warm','mineral','rose']) {
      p.settings.palette = palette; p.applyAll();
      palettes.push({palette,color:getComputedStyle(document.body).getPropertyValue('--personal-accent').trim()});
    }
    p.settings.material = 'acrylic'; p.settings.surface = 'glass'; p.applyAll();
    const nativeStatus = p.nativeStatus;
    p.settings = settings; p.applyAll();
    await app.plugins.disablePlugin('personal-glass');
    if (document.body.hasAttribute('data-personal-palette')) throw new Error('Plugin unload left attributes');
    if (document.body.style.getPropertyValue('--personal-content-width')) throw new Error('Plugin unload left width');
    await app.plugins.enablePlugin('personal-glass');
    return {commands:ids.length, insertion:true, undo:true, unload:true, palettes, nativeStatus,
      obsidian:app.version || null, electron:process.versions.electron};
  })()`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Trust author and enable plugins')?.click()`);
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1150, deviceScaleFactor: 1, mobile: false });
  await mkdir('output/obsidian', { recursive: true });
  for (const mode of ['light', 'dark']) {
    await evaluate(`document.body.classList.toggle('theme-dark', ${mode === 'dark'}); document.body.classList.toggle('theme-light', ${mode === 'light'});`);
    await evaluate('Promise.all(Array.from(document.images).filter(image => !/^https?:/.test(image.currentSrc || image.src)).map(image => image.decode().catch(() => {})))');
    // Force layout; screenshot capture paints even when the isolated window is hidden.
    await evaluate('document.body.getBoundingClientRect().toJSON()');
    assert.equal(await evaluate("document.querySelectorAll('.modal-container').length"), 0, 'A modal obscures the screenshot');
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`output/obsidian/${mode}.png`, Buffer.from(shot.data, 'base64'));
  }
  await writeFile('output/obsidian/smoke.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { socket.close(); }
