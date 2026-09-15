import { loadContent, validate } from './content.mjs';
try {
  const data = await loadContent(); const { errors, warnings } = validate(data);
  warnings.forEach(w => console.warn('提示:', w));
  if (errors.length) { errors.forEach(e => console.error(e)); process.exitCode = 1; }
  else console.log(`内容检查通过：${data.roles.length} 岗位、${data.resources.length} 资料、${data.skills.length} 技能、${data.sources.length} 来源。`);
} catch (e) { console.error(e.message); process.exitCode = 1; }
