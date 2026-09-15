import { matchesQuery, roleMatches, resourceMatches } from './search.js';
const base = document.body.dataset.base || '', page = document.body.dataset.page;
const $ = (s, root = document) => root.querySelector(s), $$ = (s, root = document) => [...root.querySelectorAll(s)];
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const dialog = $('#role-dialog');
let data, skillMap, roleMap, resourceMap, trigger, drawerRequest, pushedDrawer = false;
let drawerClosingFromHistory = false;
function announce(text) { $('#announcement').textContent = text; }
function rolePath(role) { return `${base}/roles/${role.slug}/`; }
function closeDrawer(fromHistory = false) {
  if (!dialog?.open) return;
  drawerClosingFromHistory = fromHistory;
  dialog.close();
  drawerRequest?.abort();
  if (!fromHistory) {
    if (pushedDrawer) history.back();
    else { const u = new URL(location.href); u.searchParams.delete('role'); history.replaceState({}, '', u); }
  }
  pushedDrawer = false;
  trigger?.focus();
}
async function openDrawer(id, href, push = true) {
  trigger = document.activeElement;
  drawerRequest?.abort(); drawerRequest = new AbortController();
  const request = drawerRequest;
  const target = $('#drawer-body'); target.replaceChildren(el('p', 'drawer-loading', '正在打开岗位资料…'));
  $('#drawer-full').href = href;
  if (!dialog.open) dialog.showModal();
  $('#drawer-close').focus();
  if (push) { const u = new URL(location.href); u.searchParams.set('role', id); history.pushState({ drawer: true }, '', u); pushedDrawer = true; }
  try {
    const response = await fetch(href, { signal: request.signal });
    if (!response.ok) throw new Error('无法打开页面');
    const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
    const content = parsed.querySelector('.role-content');
    if (!content) throw new Error('页面内容缺失');
    if (request.signal.aborted) return;
    target.replaceChildren(document.importNode(content, true));
    dialog.scrollTop = 0;
    dialog.setAttribute('aria-label', content.querySelector('h1')?.textContent || '岗位详情');
  } catch (e) {
    if (e.name === 'AbortError') return;
    target.replaceChildren(el('p', 'drawer-loading', '暂时无法加载详情，请使用上方“打开完整页面”继续阅读。'));
  }
}
$('#drawer-close')?.addEventListener('click', () => closeDrawer());
dialog?.addEventListener('cancel', event => { event.preventDefault(); closeDrawer(); });
dialog?.addEventListener('click', e => { if (e.target === dialog && e.clientX < dialog.getBoundingClientRect().left) closeDrawer(); });
document.addEventListener('click', async e => {
  const roleLink = e.target.closest('a.role-open');
  if (roleLink && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0 && innerWidth > 767 && typeof dialog?.showModal === 'function') {
    e.preventDefault(); openDrawer(roleLink.dataset.role, roleLink.href); return;
  }
  const copy = e.target.closest('.copy-link');
  if (copy) {
    const link = dialog.open ? $('#drawer-full').href : location.href;
    try { await navigator.clipboard.writeText(link); copy.textContent = '链接已复制'; announce('链接已复制'); setTimeout(() => copy.textContent = '复制链接', 1800); }
    catch { copy.textContent = '请复制地址栏链接'; announce('无法使用剪贴板，请复制地址栏链接'); }
  }
  const filter = e.target.closest('[data-resource-filter]');
  if (filter) {
    const section = filter.closest('section');
    const mode = filter.dataset.resourceFilter;
    $$('[data-resource-filter]', section).forEach(b => { const active = b === filter; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
    let count = 0;
    $$('.resource-row', section).forEach(row => {
      const visible = mode === 'all' || (mode === 'chinese' && /中文|中英/.test(row.dataset.language)) || (mode === 'tutorial' && /教程|课程|教材/.test(row.dataset.type)) || (mode === 'project' && /项目/.test(row.dataset.type));
      row.hidden = !visible; if (visible) count++;
    });
    $('.detail-empty', section).hidden = count > 0;
    announce(`显示 ${count} 份资料`);
  }
});
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && $('#search')) { e.preventDefault(); $('#search').focus(); } });
function updateUrl(key, value, push = false) {
  const u = new URL(location.href); value ? u.searchParams.set(key, value) : u.searchParams.delete(key);
  (push ? history.pushState : history.replaceState).call(history, {}, '', u);
  render();
}
function syncControls(params) {
  if ($('#search')) $('#search').value = params.get('q') || '';
  for (const name of ['kind', 'language', 'level', 'type', 'skill']) if ($(`#${name}`)) $(`#${name}`).value = params.get(name) || '';
}
function activeFilters(params) {
  const target = $('#active-filters'); if (!target) return;
  const relevant = [...params].filter(([k]) => !['role', 'view'].includes(k)); target.replaceChildren();
  if (!relevant.length) return;
  const box = el('div', 'filter-summary');
  const labels = relevant.map(([key, value]) => key === 'skill' ? skillMap.get(value)?.name_zh || value : key === 'category' ? data.categories.find(c => c.id === value)?.name || value : value);
  box.append(el('span', '', `当前筛选：${labels.join(' / ')}`));
  const reset = el('button', 'clear-filters', '清除全部'); box.append(reset); target.append(box);
}
function crossResults(params) {
  const section = $('#cross-results'); if (!section) return;
  const q = params.get('q'); section.hidden = !q; if (!q) return;
  const target = $('div', section); target.replaceChildren();
  const resources = data.resources.filter(r => resourceMatches(r, new URLSearchParams({ q }), skillMap));
  const topics = data.skills.filter(s => matchesQuery([s.id, s.name_zh], q));
  topics.slice(0, 4).forEach(s => { const a = el('a'); a.href = `${base}/skills/${s.id}/`; a.append(el('span', '', '技能'), document.createTextNode(s.name_zh + ' ↗')); target.append(a); });
  resources.slice(0, 6).forEach(r => { const a = el('a'); a.href = `${base}/resources/${r.slug}/`; a.append(el('span', '', '资料'), document.createTextNode(r.title + ' ↗')); target.append(a); });
  if (resources.length > 6) { const a = el('a', '', `查看全部 ${resources.length} 份匹配资料 ↗`); a.href = `${base}/resources/?q=${encodeURIComponent(q)}`; target.append(a); }
  if (!resources.length && !topics.length) section.hidden = true;
}
function renderGraph(filtered, params) {
  const panel = $('#graph-panel'); panel.replaceChildren();
  const graphSkills = data.skills.filter(s => filtered.some(r => r.skill_ids.includes(s.id)));
  const focus = params.get('skill') || (graphSkills.some(s => s.id === 'app') ? 'app' : graphSkills[0]?.id);
  const controls = el('div', 'graph-controls'); const label = el('label', '', '聚焦技能 '); const select = el('select'); select.setAttribute('aria-label', '图谱聚焦技能');
  for (const s of graphSkills) { const option = el('option', '', s.name_zh); option.value = s.id; option.selected = s.id === focus; select.append(option); }
  select.addEventListener('change', () => updateUrl('skill', select.value));
  label.append(select); controls.append(label, el('span', '', '连线表示共同技能，不代表晋升路径。')); panel.append(controls);
  const matches = filtered.filter(r => r.skill_ids.includes(focus)), shown = matches.slice(0, 8);
  if (!shown.length) { panel.append(el('p', 'notice', '当前筛选下暂无可展示的关联。')); return; }
  const network = el('div', 'network'); const ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 1000 600'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  shown.forEach((role, i) => {
    const angle = (i / shown.length) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + Math.cos(angle) * 34, y = 50 + Math.sin(angle) * 36;
    const line = document.createElementNS(ns, 'line'); for (const [k, v] of Object.entries({ x1: 500, y1: 300, x2: x * 10, y2: y * 6 })) line.setAttribute(k, v); svg.append(line);
    const a = el('a', 'node role-open', role.name_zh); a.href = rolePath(role); a.dataset.role = role.id; a.style.left = x + '%'; a.style.top = y + '%'; network.append(a);
  });
  network.prepend(svg); const center = el('a', 'node center', skillMap.get(focus)?.name_zh); center.href = `${base}/skills/${focus}/`; center.style.left = center.style.top = '50%'; network.append(center); panel.append(network);
  panel.append(el('p', 'graph-legend', `矩形为岗位，圆形为技能。展示 ${shown.length} / ${matches.length} 个关联岗位，可切换卡片查看完整结果。`));
}
function render() {
  if (!data) return;
  const params = new URLSearchParams(location.search); syncControls(params); activeFilters(params);
  let count = 0;
  if (page === 'roles') {
    const filtered = data.roles.filter(r => roleMatches(r, params, skillMap)); const ids = new Set(filtered.map(r => r.id));
    $$('#role-grid>.role-card').forEach(card => card.hidden = !ids.has(card.dataset.id)); count = filtered.length;
    const category = data.categories.find(c => c.id === params.get('category'));
    const heading = $('#results-title'); heading.replaceChildren(document.createTextNode(category?.name || '全部岗位与方向'), Object.assign(el('small', '', String(count)), { id: 'result-count' }));
    $$('.category-nav>a[data-category]').forEach(a => a.setAttribute('aria-current', String(a.dataset.category === (params.get('category') || ''))));
    const graph = params.get('view') === 'graph'; $('#graph-panel').hidden = !graph; $('#role-grid').hidden = graph;
    $$('[data-view]').forEach(b => { const active = b.dataset.view === (graph ? 'graph' : 'cards'); b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
    if (graph) renderGraph(filtered, params); crossResults(params);
  } else if (page === 'resources') {
    $$('.resource-list>.resource-row').forEach(row => { const show = resourceMatches(resourceMap.get(row.dataset.id), params, skillMap); row.hidden = !show; if (show) count++; });
    $('#result-count').textContent = `${count} 份资料`;
  } else if (page === 'skills') {
    $$('.skill-card').forEach(card => { const s = skillMap.get(card.dataset.id), show = matchesQuery([s.id, s.name_zh], params.get('q')); card.hidden = !show; if (show) count++; });
  }
  if ($('#empty')) $('#empty').hidden = count > 0;
  announce(`找到 ${count} 个结果`);
}
document.addEventListener('click', e => {
  const category = e.target.closest('.category-nav a[data-category]');
  if (category && data && !e.metaKey && !e.ctrlKey) { e.preventDefault(); updateUrl('category', category.dataset.category, true); }
  const view = e.target.closest('[data-view]'); if (view && data) updateUrl('view', view.dataset.view === 'cards' ? '' : 'graph');
  if (e.target.closest('.clear-filters')) { const u = new URL(location.href); u.search = ''; history.replaceState({}, '', u); render(); }
});
window.addEventListener('popstate', () => {
  render();
  const id = new URLSearchParams(location.search).get('role');
  if (!id) closeDrawer(true);
  else if (roleMap?.has(id)) openDrawer(id, rolePath(roleMap.get(id)), false);
});
async function start() {
  try {
    const response = await fetch(`${base}/assets/data.json`); if (!response.ok) throw new Error('数据加载失败');
    data = await response.json(); skillMap = new Map(data.skills.map(s => [s.id, s])); roleMap = new Map(data.roles.map(r => [r.id, r])); resourceMap = new Map(data.resources.map(r => [r.id, r]));
    $('.load-error')?.remove();
    let debounce;
    $('#search')?.addEventListener('input', e => { clearTimeout(debounce); const value = e.target.value; debounce = setTimeout(() => updateUrl('q', value), 120); });
    $('.search-form')?.addEventListener('submit', e => { e.preventDefault(); clearTimeout(debounce); updateUrl('q', $('#search').value); });
    for (const name of ['kind', 'language', 'level', 'type', 'skill']) $(`#${name}`)?.addEventListener('change', e => updateUrl(name, e.target.value, true));
    render();
    const id = new URLSearchParams(location.search).get('role'); if (id && roleMap.has(id)) openDrawer(id, rolePath(roleMap.get(id)), false);
  } catch {
    const notice = el('div', 'load-error', '搜索索引暂时无法加载。你仍可打开下方内容。'); const retry = el('button', '', '重新加载'); retry.addEventListener('click', () => { notice.remove(); start(); }); notice.append(retry); $('#main').prepend(notice);
  }
}
if (['roles', 'resources', 'skills', 'skill-detail'].includes(page)) start();
