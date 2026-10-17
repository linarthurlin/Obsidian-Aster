import { resolve } from 'node:path';
import assert from 'node:assert/strict';
export async function connectDemo() {
  const targets = await (await fetch('http://127.0.0.1:9237/json/list')).json();
  const target = targets.find(t => t.type === 'page' && t.url === 'app://obsidian.md/index.html' && t.title.includes('demo-vault'));
  assert(target, 'Start only the isolated demo-vault development profile on port 9237');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, reject) => { socket.addEventListener('open', ok, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout); pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.ok(message.result);
  });
  function send(method, params = {}) {
    return new Promise((ok, reject) => {
      const id = ++sequence, timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 25000);
      pending.set(id, { ok, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  const actual = await evaluate("app.vault.adapter.getBasePath().replaceAll('\\\\','/')");
  assert.equal(actual.toLowerCase(), resolve('demo-vault').replaceAll('\\','/').toLowerCase(), 'Refusing a non-demo vault');
  return { send, evaluate, close: () => socket.close() };
}
