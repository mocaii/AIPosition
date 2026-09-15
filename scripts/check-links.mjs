import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { loadContent, publicContent, canonicalUrl } from './content.mjs';
export function isPublicAddress(address) {
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  // Only global unicast IPv6, excluding documentation / transition prefixes.
  if (version === 6) return /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:(?:0:|db8:|2:|10:|20:)/i.test(address) && !/^2002:/i.test(address);
  return false;
}
export function classifyStatus(code) {
  if (code >= 200 && code < 300) return 'reachable';
  if ([401, 403, 429].includes(code)) return 'restricted';
  if ([404, 410].includes(code)) return 'not_found';
  return 'temporary_error';
}
async function request(url, method) {
  canonicalUrl(url.href);
  if (!['', '80', '443'].includes(url.port)) throw new Error('非标准端口被跳过');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await Promise.race([lookup(hostname, { all: true }), new Promise((_, reject) => setTimeout(() => reject(new Error('DNS 查询超时')), 6000).unref())]);
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new Error('非公网地址被跳过');
  const chosen = addresses[0];
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).request(url, {
      method, headers: { 'User-Agent':'AIPosition-LinkChecker/1.0 (public educational links)', Accept:'text/html,*/*;q=0.1' },
      lookup: (_host, options, cb) => options?.all ? cb(null, [chosen]) : cb(null, chosen.address, chosen.family),
    }, res => { resolve({ code: res.statusCode, location: res.headers.location }); res.destroy(); });
    req.setTimeout(8000, () => req.destroy(new Error('连接超时')));
    const total = setTimeout(() => req.destroy(new Error('请求超时')), 10000);
    req.on('error', reject); req.on('close', () => clearTimeout(total)); req.end();
  });
}
export async function checkUrl(input) {
  let url = new URL(input);
  try {
    for (let i = 0; i < 5; i++) {
      let result = await request(url, 'HEAD');
      if ([405, 501].includes(result.code)) result = await request(url, 'GET');
      if ([301, 302, 303, 307, 308].includes(result.code) && result.location) { url = new URL(result.location, url); continue; }
      return { status: classifyStatus(result.code), http_status: result.code, resolved_url: url.href };
    }
    return { status:'temporary_error', note:'跳转次数过多' };
  } catch(e) { return { status:'temporary_error', note:e.message }; }
}
async function main() {
  const resources = publicContent(await loadContent()).resources;
  const results = []; let index = 0;
  const count = process.env.LINK_CHECK_LIMIT ? Math.max(1, Number(process.env.LINK_CHECK_LIMIT)) : resources.length;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (index < Math.min(resources.length, count)) {
      const r = resources[index++]; const result = await checkUrl(r.url); results.push({ id:r.id, title:r.title, url:r.url, checked_at:new Date().toISOString(), ...result });
      console.log(`${r.id}: ${result.status}`);
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }));
  results.sort((a,b) => a.id.localeCompare(b.id));
  await writeFile('link-report.json', JSON.stringify(results, null, 2));
  const escape = x => String(x).replace(/[\r\n|]/g, ' ').replace(/[<>]/g, '');
  const problems = results.filter(r => r.status !== 'reachable');
  const report = ['<!-- ai-position-link-report -->', '# 学习资料链接检查', '', `检查 ${results.length} 个入口，${problems.length} 个需要人工确认。`, '', '403、429 和超时不代表资料失效。本报告不自动删除资料，也不改变人工核验状态。', '', '| ID | 资料 | 结果 | HTTP / 说明 |', '|---|---|---|---|', ...problems.map(r => `| ${r.id} | ${escape(r.title)} | ${r.status} | ${escape(r.http_status || r.note || '')} |`)].join('\n');
  await writeFile('link-report.md', report + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e); process.exitCode = 1; });
