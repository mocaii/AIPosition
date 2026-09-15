import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContent, parseYaml, validate, publicContent, canonicalUrl } from '../scripts/content.mjs';
import { repositoryUrl } from '../scripts/config.mjs';
import { isPublicAddress, classifyStatus } from '../scripts/check-links.mjs';
import { matchesQuery, roleMatches, resourceMatches } from '../src/assets/search.js';
const original = await loadContent();
const clone = () => structuredClone(original);
test('当前内容结构与全部跨文件引用有效', () => assert.deepEqual(validate(clone()).errors, []));
test('YAML 重复键不会静默覆盖', () => assert.throws(() => parseYaml('id: R001\nid: R002')));
test('相同资料的跟踪参数不绕过去重', () => {
  const d = clone(); d.resources[1].url = d.resources[0].url + '?utm_source=share';
  assert.ok(validate(d).errors.some(e => e.includes('重复')));
});
test('不存在的资料与父子循环阻止发布', () => {
  const d = clone(); d.roles[0].resources.push({ id:'R404', reason:'' }); d.roles[0].parent_id = d.roles[1].id; d.roles[1].parent_id = d.roles[0].id;
  const errors = validate(d).errors; assert.ok(errors.some(e => e.includes('R404'))); assert.ok(errors.some(e => e.includes('循环')));
});
test('格式错误的字段返回清楚的校验错误', () => {
  const d = clone(); d.roles[0].skill_ids = 12; d.resources[0].alternate_urls = 42;
  const errors = validate(d).errors; assert.ok(errors.some(e => e.includes('skill_ids'))); assert.ok(errors.some(e => e.includes('alternate_urls')));
});
test('草稿和归档内容及其关联从公开数据中移除', () => {
  const d = clone(), hidden = d.roles[0].resources[0].id;
  d.resources.find(r => r.id === hidden).status = 'draft';
  d.skills.find(s => s.id === 'app').status = 'draft';
  d.roles.find(r => r.id === 'P001').status = 'archived';
  d.sources[0].status = 'draft';
  const published = publicContent(d);
  assert.ok(!published.resources.some(r => r.id === hidden));
  assert.ok(published.roles.every(r => r.resources.every(x => x.id !== hidden)));
  assert.ok(published.roles.every(r => !r.skill_ids.includes('app')));
  assert.ok(published.roles.every(r => r.parent_id !== 'P001'));
  assert.ok(!published.sources.some(s => s.id === d.sources[0].id));
});
test('中文、缩写、全角输入和别名可搜索', () => {
  const map = new Map(original.skills.map(s => [s.id,s])); const fde = original.roles.find(r => r.id === 'P001');
  for (const q of ['FDE','ｆｄｅ','驻场 AI 工程师','系统集成']) assert.ok(roleMatches(fde, new URLSearchParams({q}), map));
  assert.equal(roleMatches(fde, new URLSearchParams({ q:'FDE', category:'C03' }), map), false);
  assert.ok(matchesQuery(['Hello Agents','Datawhale'], 'hello datawhale'));
});
test('中文资料筛选与技能过滤可组合', () => {
  const map = new Map(original.skills.map(s => [s.id,s])); const r = original.resources.find(r => r.id === 'R013');
  assert.ok(resourceMatches(r, new URLSearchParams({ language:'chinese',skill:'agent',q:'hello' }), map));
  assert.equal(resourceMatches(r,new URLSearchParams({language:'english'}),map),false);
});
test('仓库只接受合法 GitHub 地址', () => {
  assert.equal(repositoryUrl('git@github.com:owner/project.git'),'https://github.com/owner/project');
  assert.equal(repositoryUrl('owner/project'),'https://github.com/owner/project');
  assert.equal(repositoryUrl('https://evil.test/a/b'),'');
  assert.equal(repositoryUrl('javascript:alert(1)'),'');
});
test('链接检查禁止私网、回环、元数据与过渡 IPv6', () => {
  for (const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','172.16.1.2','192.168.1.1','100.64.1.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1','2002:7f00:1::']) assert.equal(isPublicAddress(ip),false,ip);
  assert.equal(isPublicAddress('8.8.8.8'),true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'),true);
});
test('限流和拒绝访问不能被当作链接失效', () => {
  assert.equal(classifyStatus(429),'restricted'); assert.equal(classifyStatus(403),'restricted'); assert.equal(classifyStatus(404),'not_found'); assert.equal(classifyStatus(503),'temporary_error');
});
test('URL 标准化保留有意义的参数，拒绝脚本和凭据', () => {
  assert.equal(canonicalUrl('https://example.com/a?q=rag&utm_source=x#part'),'https://example.com/a?q=rag');
  assert.throws(() => canonicalUrl('javascript:alert(1)')); assert.throws(() => canonicalUrl('https://user:pass@example.com'));
});
