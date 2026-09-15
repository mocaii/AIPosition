export const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export function matchesQuery(values, query) {
  const text = normalize(values.flat(Infinity).filter(Boolean).join(' '));
  return normalize(query).split(' ').filter(Boolean).every(token => text.includes(token));
}
export function roleMatches(role, params, skills) {
  return (!params.get('category') || role.category === params.get('category')) &&
    (!params.get('kind') || role.kind === params.get('kind')) &&
    (!params.get('skill') || role.skill_ids.includes(params.get('skill'))) &&
    matchesQuery([role.name_zh, role.name_en, role.aliases, role.summary, role.skill_ids, role.skill_ids.map(id => skills.get(id)?.name_zh)], params.get('q'));
}
export function resourceMatches(resource, params, skills) {
  const language = params.get('language');
  return (!language || (language === 'chinese' ? /中文|中英/.test(resource.language) : /英文/.test(resource.language))) &&
    (!params.get('level') || resource.level === params.get('level')) &&
    (!params.get('type') || resource.type === params.get('type')) &&
    (!params.get('skill') || resource.skill_ids.includes(params.get('skill'))) &&
    matchesQuery([resource.title, resource.publisher, resource.description, resource.skill_ids, resource.skill_ids.map(id => skills.get(id)?.name_zh)], params.get('q'));
}
