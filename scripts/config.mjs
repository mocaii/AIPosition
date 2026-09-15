import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
export function repositoryUrl(value = '') {
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) value = `https://github.com/${value}`;
  value = value.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '').replace(/\/$/, '');
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(value) ? value : '';
}
export async function getConfig() {
  const config = JSON.parse(await readFile('site.config.json', 'utf8'));
  let remote = '';
  try { remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  const repository = repositoryUrl(process.env.SITE_REPOSITORY || config.repository || process.env.GITHUB_REPOSITORY || remote);
  let basePath = process.env.BASE_PATH ?? config.basePath ?? '';
  basePath = '/' + basePath.split('/').filter(Boolean).join('/');
  if (basePath === '/') basePath = '';
  if (!/^(\/[A-Za-z0-9._-]+)*$/.test(basePath)) throw new Error('BASE_PATH 格式不合法');
  const siteUrl = (process.env.SITE_URL || config.siteUrl || '').replace(/\/$/, '');
  if (siteUrl && !/^https?:\/\//.test(siteUrl)) throw new Error('SITE_URL 应为完整 HTTP(S) 地址');
  return { ...config, repository, branch: process.env.SITE_BRANCH || config.branch || 'main', basePath, siteUrl };
}
