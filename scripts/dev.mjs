import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { spawn } from 'node:child_process';
const port = Number(process.env.PORT || 4321), root = resolve('dist');
function build() { return new Promise((ok, fail) => { const p = spawn(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' }); p.on('exit', code => code === 0 ? ok() : fail(new Error('构建失败'))); }); }
await build();
let building = false, queued = false, timer;
async function rebuild() { if (building) { queued = true; return; } building = true; try { await build(); console.log('内容已更新，刷新浏览器即可。'); } catch(e) { console.error(e.message); } finally { building = false; if (queued) { queued = false; rebuild(); } } }
for (const dir of ['content', 'src', 'scripts']) watch(dir, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(rebuild, 180); });
watch('site.config.json', () => rebuild());
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.xml':'application/xml', '.txt':'text/plain; charset=utf-8' };
createServer(async (req, res) => {
  try {
    const config = JSON.parse(await readFile('dist/build-info.json', 'utf8'));
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (config.basePath) { if (!pathname.startsWith(config.basePath + '/') && pathname !== config.basePath) { res.writeHead(404); res.end('Not found'); return; } pathname = pathname.slice(config.basePath.length) || '/'; }
    let file = resolve(root, '.' + pathname);
    if (!file.startsWith(root + sep) && file !== root) { res.writeHead(403); res.end('Forbidden'); return; }
    try { if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html'); const body = await readFile(file); res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' }); res.end(req.method === 'HEAD' ? undefined : body); }
    catch { res.writeHead(404, { 'Content-Type':'text/html; charset=utf-8' }); res.end(await readFile(resolve(root, '404.html'))); }
  } catch { res.writeHead(500); res.end('Preview temporarily unavailable'); }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}${process.env.BASE_PATH || ''}/`));
