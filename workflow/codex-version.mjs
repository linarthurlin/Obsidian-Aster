import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';

// Codex Panel's public compatibility notes also pin behavior to tested CLI minors.
// Aster currently verifies the 0.162.x app-server protocol on Windows.
export const TESTED_CODEX_VERSION = Object.freeze({ major: 0, minor: 162 });

function validateExecutable(executable) {
  if (typeof executable !== 'string' || !executable.trim() || /[\u0000\r\n]/.test(executable)
    || /\.(cmd|bat|ps1)$/i.test(executable) || (!isAbsolute(executable) && executable !== 'codex')) {
    throw new Error('Choose codex on PATH or an absolute trusted CLI executable, not a shell wrapper.');
  }
}

export function parseCodexVersion(output) {
  if (typeof output !== 'string' || output.length > 4096) return null;
  const match = output.match(/\bcodex(?:-cli)?\s+(\d+)\.(\d+)\.(\d+)(?:[-+][a-zA-Z0-9.-]+)?\b/i);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), text: `${match[1]}.${match[2]}.${match[3]}` };
}

export function isSupportedCodexVersion(version) {
  return !!version && version.major === TESTED_CODEX_VERSION.major && version.minor === TESTED_CODEX_VERSION.minor;
}

export async function readCodexVersion(executable = 'codex', { timeoutMs = 10000, spawnProcess = spawn } = {}) {
  validateExecutable(executable);
  return new Promise((resolve, reject) => {
    let child, output = '', settled = false;
    const finish = (error, version) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve(version);
    };
    const timer = setTimeout(() => {
      child?.kill(); finish(new Error('Codex CLI version check timed out.'));
    }, Math.min(30000, Math.max(100, timeoutMs)));
    try { child = spawnProcess(executable, ['--version'], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: process.env }); }
    catch (error) { finish(new Error('Cannot start Codex CLI version check: ' + error.message)); return; }
    const append = chunk => {
      output += chunk.toString();
      if (Buffer.byteLength(output) > 4096) { child.kill(); finish(new Error('Codex CLI version output exceeded its limit.')); }
    };
    child.stdout.on('data', append); child.stderr.on('data', append);
    child.on('error', error => finish(new Error('Cannot start Codex CLI version check: ' + error.message)));
    child.on('close', code => {
      if (code !== 0) { finish(new Error('Codex CLI version check failed.')); return; }
      const version = parseCodexVersion(output);
      if (!version) { finish(new Error('Codex CLI returned an unrecognized version. Aster Chat requires a supported Codex CLI.')); return; }
      if (!isSupportedCodexVersion(version)) {
        finish(new Error(`Aster live Chat currently supports Codex ${TESTED_CODEX_VERSION.major}.${TESTED_CODEX_VERSION.minor}.x; found ${version.text}.`));
        return;
      }
      finish(null, version);
    });
  });
}
