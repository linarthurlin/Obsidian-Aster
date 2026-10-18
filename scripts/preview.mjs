import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const port = Number(process.env.PORT || 4178);
const routes = { '/': ['preview/index.html', 'text/html; charset=utf-8'], '/theme.css': ['dist/theme/theme.css', 'text/css'], '/orbit.svg': ['demo-vault/assets/orbit.svg', 'image/svg+xml'] };
routes['/selection'] = ['preview/selection.html', 'text/html; charset=utf-8'];
routes['/selection-frame'] = ['preview/selection-frame.html', 'text/html; charset=utf-8'];
routes['/plugin.css'] = ['dist/plugin/styles.css', 'text/css'];
createServer(async (req, res) => {
  const route = routes[new URL(req.url, `http://127.0.0.1:${port}`).pathname];
  if (!route) { res.writeHead(404); res.end('Not found'); return; }
  try { res.writeHead(200, { 'Content-Type': route[1] }); res.end(await readFile(route[0])); }
  catch { res.writeHead(500); res.end('Run npm run build first.'); }
}).listen(port, '127.0.0.1', () => console.log(`Synthetic preview: http://127.0.0.1:${port}`));
