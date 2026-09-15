import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { stringify } from 'yaml';
const seed = JSON.parse(await readFile('research/ai-careers/knowledge-base.json', 'utf8'));
const categories = [...new Set(seed.roles.map(r => r.category))].map((name, i) => ({ id: `C${String(i + 1).padStart(2, '0')}`, name, order: i + 1 }));
const categoryId = new Map(categories.map(c => [c.name, c.id]));
let created = 0, skipped = 0;
async function save(path, value) {
  try { await access(path); skipped++; return; } catch {}
  await writeFile(path, stringify(value, { lineWidth: 0 })); created++;
}
await mkdir('content', { recursive: true });
await save('content/categories.yaml', categories);
for (const collection of ['roles', 'resources', 'skills', 'sources']) {
  await mkdir(`content/${collection}`, { recursive: true });
  for (const original of seed[collection]) {
    const item = structuredClone(original);
    item.status = 'published';
    if (collection === 'roles') {
      item.category = categoryId.get(item.category);
      item.slug = `${item.id.toLowerCase()}-${item.name_en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
      item.resources = item.resource_ids.map(id => ({ id, reason: '' }));
      delete item.resource_ids;
      delete item.related_role_ids;
    }
    if (collection === 'resources') item.slug = item.id.toLowerCase();
    await save(`content/${collection}/${item.id}.yaml`, item);
  }
}
console.log(`导入完成：新增 ${created} 个文件，跳过 ${skipped} 个已存在文件（不覆盖人工编辑）。`);
