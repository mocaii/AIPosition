import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const info = JSON.parse(await readFile('dist/build-info.json','utf8'));
const base = info.basePath, errors = [];
const unescape = value => value.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'");
async function walk(dir) { const all = []; for (const e of await readdir(dir,{withFileTypes:true})) { const p = `${dir}/${e.name}`; if(e.isDirectory()) all.push(...await walk(p)); else if(p.endsWith('.html')) all.push(p); } return all; }
for (const path of await walk('dist')) {
  const html = await readFile(path,'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]*)"/g)) {
    const value = unescape(match[1]); if (!value.startsWith('/')) continue;
    if (base && !value.startsWith(base + '/') && value !== base) { errors.push(`${path}: 路径缺少 base ${value}`); continue; }
    let pathname = value.split(/[?#]/)[0].slice(base.length);
    try { pathname = decodeURIComponent(pathname); } catch { errors.push(`${path}: URL 编码错误`); continue; }
    try { await stat(resolve('dist','.' + pathname)); } catch { errors.push(`${path}: 内部链接缺失 ${value}`); }
  }
  if (!html.includes('<title>') || !html.includes('name="description"')) errors.push(`${path}: 页面元信息缺失`);
}
if (errors.length) throw new Error([...new Set(errors)].slice(0,30).join('\n'));
console.log('静态页面内部链接、资源路径和页面元信息检查通过。');
