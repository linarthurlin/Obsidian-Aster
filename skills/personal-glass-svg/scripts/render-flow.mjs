import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const palettes = {
  light: { bg: '#f4f2eb', card: '#fffdf7', text: '#2b3328', muted: '#5b6855', edge: '#a6b39b', accent: '#587247' },
  dark: { bg: '#20231f', card: '#2c3228', text: '#e8eedf', muted: '#b7c3aa', edge: '#637454', accent: '#b6cc9e' },
};
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const measure = text => [...text].reduce((width, char) => width + (/[^\x00-\xff]/.test(char) ? 1 : /[MW@]/.test(char) ? .85 : .55), 0);
function wrap(text, limit = 24) {
  const lines = []; let line = '';
  for (const segment of new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)) {
    const token = segment.segment;
    if (line && measure(line + token) > limit) { lines.push(line.trim()); line = ''; }
    for (const char of token) {
      if (measure(line + char) > limit) { lines.push(line.trim()); line = ''; }
      line += char;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}
export function renderFlow(input, mode) {
  if (!input || typeof input.title !== 'string' || !input.title.trim() || typeof input.description !== 'string'
    || !Array.isArray(input.nodes) || input.nodes.length < 2 || input.nodes.length > 12) throw new Error('Expected title, description and 2–12 nodes');
  const palette = palettes[mode]; if (!palette) throw new Error('Expected light or dark');
  const nodes = input.nodes.map(node => {
    if (typeof node.title !== 'string' || typeof node.detail !== 'string' || node.title.length > 100 || node.detail.length > 240) throw new Error('Invalid or oversized node');
    // measure() returns approximate em units; reserve extra space for font variation.
    const title = wrap(node.title, 10), detail = wrap(node.detail, 13);
    if (title.length > 3 || detail.length > 4) throw new Error('Labels need a larger/custom layout');
    return { title, detail };
  });
  const cols = Math.min(3, nodes.length), width = 100 + cols * 260 + (cols - 1) * 50;
  if (measure(input.title) * 26 > width - 100 || measure(input.description) * 14 > width - 100)
    throw new Error('Title or description needs a larger/custom layout');
  const nodeHeight = Math.max(150, ...nodes.map(node => 42 + node.title.length * 26 + 12 + node.detail.length * 20));
  const rows = Math.ceil(nodes.length / cols), height = 124 + rows * nodeHeight + (rows - 1) * 70 + 44;
  const positions = nodes.map((_node, i) => { const row = Math.floor(i / cols), col = row % 2 ? cols - 1 - i % cols : i % cols; return { x: 50 + col * 310, y: 124 + row * (nodeHeight + 70) }; });
  const links = positions.slice(0, -1).map((a, i) => {
    const b = positions[i + 1];
    const path = a.y === b.y ? a.x < b.x ? `M${a.x + 260} ${a.y + nodeHeight / 2}H${b.x - 10}` : `M${a.x} ${a.y + nodeHeight / 2}H${b.x + 270}`
      : `M${a.x + 130} ${a.y + nodeHeight}V${b.y - 10}`;
    return `<path d="${path}" fill="none" stroke="${palette.accent}" stroke-width="2" marker-end="url(#arrow)"/>`;
  }).join('');
  const cards = nodes.map((node, i) => {
    const { x, y } = positions[i];
    const title = node.title.map((line, n) => `<tspan x="${x + 24}" y="${y + 40 + n * 26}">${escape(line)}</tspan>`).join('');
    const detail = node.detail.map((line, n) => `<tspan x="${x + 24}" y="${y + 54 + node.title.length * 26 + n * 20}">${escape(line)}</tspan>`).join('');
    return `<g><rect x="${x}" y="${y}" width="260" height="${nodeHeight}" rx="18" fill="${palette.card}" stroke="${palette.edge}"/><text font-size="20" font-weight="600" fill="${palette.text}">${title}</text><text font-size="15" fill="${palette.muted}">${detail}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${escape(input.title)}</title><desc id="desc">${escape(input.description)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1L8 5L1 9" fill="none" stroke="${palette.accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs><rect width="${width}" height="${height}" rx="24" fill="${palette.bg}"/><g font-family="Segoe UI, Microsoft JhengHei, Noto Sans CJK TC, sans-serif"><text x="50" y="62" font-size="26" font-weight="650" fill="${palette.text}">${escape(input.title)}</text><text x="50" y="92" font-size="14" fill="${palette.muted}">${escape(input.description)}</text>${links}${cards}</g></svg>\n`;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: node render-flow.mjs input.json output-prefix');
  const structure = JSON.parse(await readFile(input, 'utf8'));
  for (const mode of ['light', 'dark']) await writeFile(`${output}-${mode}.svg`, renderFlow(structure, mode));
}
