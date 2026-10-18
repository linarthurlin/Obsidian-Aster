import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { readCodexVersion } from './codex-version.mjs';

const DISABLED = ['shell_tool', 'plugins', 'apps', 'browser_use', 'computer_use', 'multi_agent', 'memories'];
function validateExecutable(executable) {
  if (typeof executable !== 'string' || !executable.trim() || /[\u0000\r\n]/.test(executable)
    || /\.(cmd|bat|ps1)$/i.test(executable) || (!isAbsolute(executable) && executable !== 'codex')) {
    throw new Error('Choose codex on PATH or an absolute trusted CLI executable, not a shell wrapper.');
  }
}
export function normalizeModelCatalog(response) {
  if (!response || !Array.isArray(response.data)) throw new Error('Codex returned an invalid model catalog.');
  return response.data.map(model => ({
    id: typeof model.model === 'string' ? model.model : (typeof model.id === 'string' ? model.id : ''),
    label: typeof model.displayName === 'string' ? model.displayName : String(model.model || model.id || ''),
    reasoningEfforts: Array.isArray(model.supportedReasoningEfforts)
      ? model.supportedReasoningEfforts.map(option => option?.reasoningEffort).filter(value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,20}$/.test(value))
      : [],
    isDefault: model.isDefault === true,
  })).filter(model => /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,100}$/.test(model.id)).slice(0, 200);
}
export async function listCodexModels(executable = 'codex', { timeoutMs = 15000 } = {}) {
  validateExecutable(executable);
  await readCodexVersion(executable, { timeoutMs });
  return new Promise((resolve, reject) => {
    const args = ['app-server', '--listen', 'stdio://', ...DISABLED.flatMap(feature => ['--disable', feature]), '-c', 'mcp_servers={}', '-c', 'project_doc_max_bytes=0', '-c', 'web_search="disabled"'];
    let child, buffer = '', bytes = 0, closed = false, nextId = 1, overall;
    const pending = new Map();
    const fail = error => {
      if (closed) return;
      closed = true;
      clearTimeout(overall);
      for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
      pending.clear();
      child?.kill();
      reject(error);
    };
    const parse = line => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (message && Number.isInteger(message.id) && pending.has(message.id)) {
        const entry = pending.get(message.id);
        pending.delete(message.id); clearTimeout(entry.timer);
        if (message.error) entry.reject(new Error(String(message.error.message || 'Codex app-server request failed.')));
        else entry.resolve(message.result);
      }
    };
    const request = (method, params = {}) => new Promise((res, rej) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        rej(new Error('Codex app-server timed out during ' + method + '.'));
      }, timeoutMs);
      pending.set(id, { resolve: res, reject: rej, timer });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n', error => {
        if (error) { clearTimeout(timer); pending.delete(id); rej(new Error('Codex app-server closed its input.')); }
      });
    });
    try {
      child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    } catch (error) { fail(new Error('Cannot start Codex app-server: ' + error.message)); return; }
    overall = setTimeout(() => fail(new Error('Codex model catalog timed out.')), timeoutMs * 2);
    child.stdout.on('data', data => {
      bytes += data.length;
      if (bytes > 2000000) { fail(new Error('Codex app-server output exceeded the 2MB limit.')); return; }
      buffer += data.toString();
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() || '';
      for (const line of lines) parse(line);
    });
    child.stderr.on('data', data => { bytes += data.length; if (bytes > 2000000) fail(new Error('Codex app-server output exceeded the 2MB limit.')); });
    child.on('error', error => fail(new Error('Cannot start Codex app-server: ' + error.message)));
    child.on('close', code => {
      if (closed) return;
      closed = true; clearTimeout(overall);
      for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Codex app-server exited (code ' + code + ').')); }
      pending.clear();
      reject(new Error('Codex app-server exited before returning the model catalog.'));
    });
    (async () => {
      try {
        await request('initialize', { clientInfo: { name: 'aster_obsidian', title: 'Aster for Obsidian', version: '0.2.1' } });
        if (closed) return;
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} }) + '\n');
        const response = await request('model/list', { includeHidden: false });
        if (closed) return;
        const models = normalizeModelCatalog(response);
        closed = true; clearTimeout(overall);
        child.stdin.end();
        child.kill();
        resolve(models);
      } catch (error) { fail(error instanceof Error ? error : new Error('Codex model catalog failed.')); }
    })();
  });
}
