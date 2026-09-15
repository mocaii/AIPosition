import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseDocument } from 'yaml';
export const KINDS = { role: '岗位实例', specialization: '细分方向', practice_title: '企业实践称谓', skill_direction: '技能方向', occupation: '国内职业', occupation_subtype: '国内工种', industry_variant: '行业变体' };
export const VERIFICATION = { page_opened: '已打开入口', search_result_confirmed: '仅搜索确认', fetch_blocked: '访问受限', historical_search_evidence: '历史检索证据' };
export function parseYaml(text, file = 'YAML') {
  const doc = parseDocument(text, { uniqueKeys: true });
  if (doc.errors.length) throw new Error(`${file}: ${doc.errors.map(e => e.message).join('; ')}`);
  return doc.toJS({ maxAliasCount: 30 });
}
export async function loadContent(root = 'content') {
  const result = { categories: parseYaml(await readFile(resolve(root, 'categories.yaml'), 'utf8'), 'categories.yaml') };
  for (const group of ['roles', 'resources', 'skills', 'sources']) {
    const files = (await readdir(resolve(root, group))).filter(f => f.endsWith('.yaml')).sort();
    result[group] = await Promise.all(files.map(async file => {
      const value = parseYaml(await readFile(resolve(root, group, file), 'utf8'), `${group}/${file}`);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${group}/${file}: 顶层必须是对象`);
      return { ...value, _file: `${group}/${file}` };
    }));
  }
  return result;
}
export function canonicalUrl(value) {
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw new Error('需要无凭据的 HTTP(S) 链接');
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (/^(utm_.+|fbclid|gclid)$/i.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  return u.href.replace(/\/$/, '');
}
export function validate(data) {
  const errors = [], warnings = [];
  const issue = (r, msg) => errors.push(`${r._file || r.id || '内容'}: ${msg}`);
  const text = (r, k) => { if (typeof r[k] !== 'string' || !r[k].trim()) issue(r, `缺少文本字段 ${k}`); };
  const array = (r, k) => { if (!Array.isArray(r[k]) || r[k].some(v => typeof v !== 'string' || !v)) issue(r, `${k} 必须是字符串数组`); else if (new Set(r[k]).size !== r[k].length) issue(r, `${k} 有重复项`); };
  const maps = {};
  for (const group of ['categories', 'roles', 'resources', 'skills', 'sources']) {
    if (!Array.isArray(data[group])) { errors.push(`${group} 必须是数组`); data[group] = []; }
    maps[group] = new Map();
    const slugs = new Set();
    for (const r of data[group]) {
      if (!r || typeof r !== 'object') { errors.push(`${group} 条目必须是对象`); continue; }
      text(r, 'id');
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(r.id || '')) issue(r, 'ID 格式不合法');
      if (maps[group].has(r.id)) issue(r, `ID ${r.id} 重复`);
      maps[group].set(r.id, r);
      if (group !== 'categories') {
        if (!['draft', 'published', 'archived'].includes(r.status)) issue(r, 'status 只能为 draft/published/archived');
        if (r._file && r._file !== `${group}/${r.id}.yaml`) issue(r, '文件名必须与 ID 一致');
      }
      if (['roles', 'resources'].includes(group)) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug || '')) issue(r, 'slug 必须为小写字母、数字和短横线');
        if (slugs.has(r.slug)) issue(r, 'slug 重复'); slugs.add(r.slug);
      }
    }
  }
  if (['categories', 'roles', 'resources', 'skills', 'sources'].some(g => data[g].some(r => !r || typeof r !== 'object'))) return { errors, warnings };
  function refs(r, ids, group) {
    for (const id of Array.isArray(ids) ? ids : []) {
      if (!maps[group].has(id)) issue(r, `不存在的 ${group} 引用 ${id}`);
      else if (r.status === 'published' && maps[group].get(id).status && maps[group].get(id).status !== 'published') warnings.push(`${r.id}: ${id} 未发布，公开页面将忽略该关联`);
    }
  }
  for (const r of data.categories) { text(r, 'name'); if (!Number.isFinite(r.order)) issue(r, 'order 必须为数字'); }
  for (const r of data.skills) text(r, 'name_zh');
  for (const r of data.roles) {
    for (const k of ['name_zh', 'name_en', 'summary', 'category']) text(r, k);
    if (!KINDS[r.kind]) issue(r, '未知 kind');
    for (const k of ['aliases', 'skill_ids', 'source_ids']) array(r, k);
    refs(r, [r.category], 'categories'); refs(r, r.skill_ids, 'skills'); refs(r, r.source_ids, 'sources');
    if (!Array.isArray(r.resources)) issue(r, 'resources 必须是数组');
    else {
      const ids = [];
      for (const link of r.resources) {
        if (!link || typeof link.id !== 'string' || typeof link.reason !== 'string') issue(r, '资料关联必须包含 id 和 reason 文本');
        else ids.push(link.id);
      }
      refs(r, ids, 'resources'); if (new Set(ids).size !== ids.length) issue(r, '资料关联重复');
    }
    if (r.kind === 'role' && r.status === 'published' && !r.source_ids?.length) issue(r, '发布岗位实例需要至少一条来源');
    if (r.parent_id) refs(r, [r.parent_id], 'roles');
    const seen = new Set([r.id]); let parent = r.parent_id;
    while (parent && maps.roles.has(parent)) { if (seen.has(parent)) { issue(r, '父岗位存在循环'); break; } seen.add(parent); parent = maps.roles.get(parent).parent_id; }
  }
  const urls = new Map();
  for (const r of data.resources) {
    for (const k of ['title', 'url', 'publisher', 'type', 'language', 'description', 'level']) text(r, k);
    if (!['入门', '基础', '进阶', '高级'].includes(r.level)) issue(r, '未知难度');
    array(r, 'skill_ids'); refs(r, r.skill_ids, 'skills');
    if (!VERIFICATION[r.verification_status]) issue(r, '未知核验状态');
    try { const url = canonicalUrl(r.url); if (urls.has(url)) issue(r, `资料链接与 ${urls.get(url)} 重复`); urls.set(url, r.id); } catch { issue(r, 'url 不合法'); }
    if (r.alternate_urls !== undefined) array(r, 'alternate_urls');
    for (const u of Array.isArray(r.alternate_urls) ? r.alternate_urls : []) try { canonicalUrl(u); } catch { issue(r, '备用链接不合法'); }
  }
  for (const r of data.sources) {
    for (const k of ['title', 'organization', 'url', 'evidence_type']) text(r, k);
    if (!VERIFICATION[r.verification_status]) issue(r, '未知核验状态');
    try { canonicalUrl(r.url); } catch { issue(r, 'url 不合法'); }
  }
  return { errors, warnings };
}
export function publicContent(data) {
  const result = { categories: data.categories };
  for (const key of ['roles', 'resources', 'skills', 'sources']) result[key] = data[key].filter(x => x.status === 'published').map(x => structuredClone(x));
  const sets = Object.fromEntries(['roles', 'resources', 'skills', 'sources'].map(k => [k, new Set(result[k].map(x => x.id))]));
  for (const role of result.roles) {
    role.skill_ids = role.skill_ids.filter(id => sets.skills.has(id));
    role.source_ids = role.source_ids.filter(id => sets.sources.has(id));
    role.resources = role.resources.filter(r => sets.resources.has(r.id));
    if (!sets.roles.has(role.parent_id)) role.parent_id = null;
  }
  for (const r of result.resources) r.skill_ids = r.skill_ids.filter(id => sets.skills.has(id));
  return result;
}
