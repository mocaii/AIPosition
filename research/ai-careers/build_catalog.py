"""从经过编辑的 knowledge-base.json 生成阅读版目录，并校验引用完整性。"""
from pathlib import Path
import json
from collections import Counter
import zipfile

ROOT = Path(__file__).resolve().parent
data = json.loads((ROOT / 'knowledge-base.json').read_text())
roles, resources, skills, sources = (data[k] for k in ('roles', 'resources', 'skills', 'sources'))
role_by_id = {r['id']: r for r in roles}
resource_by_id = {r['id']: r for r in resources}
source_by_id = {s['id']: s for s in sources}
skill_by_id = {s['id']: s for s in skills}
KINDS = {'role': '岗位实例', 'specialization': '岗位细分方向', 'practice_title': '企业实践称谓', 'skill_direction': '技能方向（编辑分类）', 'occupation': '国内职业', 'occupation_subtype': '国内工种', 'industry_variant': '行业变体'}
STATUSES = {'page_opened': '已打开入口', 'search_result_confirmed': '仅搜索确认', 'fetch_blocked': '访问受限·待复核', 'historical_search_evidence': '历史检索证据'}

def dump(name, obj):
    (ROOT / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')

def md(name, text):
    (ROOT / name).write_text(text.rstrip() + '\n')

def tags(ids):
    return '、'.join(skill_by_id[s]['name_zh'] for s in ids)

def safe(text):
    return str(text).replace('|', '／').replace('\n', ' ')

errors = []
for collection in (roles, resources, skills, sources):
    if len(collection) != len({r['id'] for r in collection}):
        errors.append('存在重复 ID')
if len(resources) != len({r['url'].rstrip('/') for r in resources}):
    errors.append('资料存在重复主链接')
for r in roles:
    for rid in r['resource_ids']:
        if rid not in resource_by_id:
            errors.append(f"{r['id']} 资料引用失效: {rid}")
    for sid in r['source_ids']:
        if sid not in source_by_id:
            errors.append(f"{r['id']} 来源引用失效: {sid}")
    if r['parent_id'] and r['parent_id'] not in role_by_id:
        errors.append(f"{r['id']} 父条目不存在")
    if len(r['resource_ids']) < 3:
        errors.append(f"{r['id']} 关联资料不足 3 份")
    seen, parent = {r['id']}, r['parent_id']
    while parent:
        if parent in seen:
            errors.append(f"{r['id']} 父条目循环")
            break
        seen.add(parent)
        parent = role_by_id[parent]['parent_id']
for item in roles + resources:
    for sid in item['skill_ids']:
        if sid not in skill_by_id:
            errors.append(f"{item['id']} 未定义技能: {sid}")
for r in resources:
    if not any(r['id'] in role['resource_ids'] for role in roles):
        errors.append(f"{r['id']} 未关联岗位")
    if r['verification_status'] not in STATUSES:
        errors.append(f"{r['id']} 未完成核验分类")
    if not r['url'].startswith('https://'):
        errors.append(f"{r['id']} 链接格式异常")
if errors:
    raise SystemExit('\n'.join(errors))

relations = []
for r in roles:
    if r['parent_id']:
        relations.append({'type': 'specializes', 'from': r['id'], 'to': r['parent_id']})
    for s in r['skill_ids']:
        relations.append({'type': 'role_uses_skill', 'from': r['id'], 'to': s})
    for i, rid in enumerate(r['resource_ids'], 1):
        relations.append({'type': 'role_recommends_resource', 'from': r['id'], 'to': rid, 'display_order': i, 'basis': 'editorial_recommendation'})
for r in resources:
    for sid in r['skill_ids']:
        relations.append({'type': 'resource_covers_skill', 'from': r['id'], 'to': sid})
for key in ('roles', 'resources', 'skills', 'sources'):
    dump(key + '.json', data[key])
dump('relations.json', relations)

overview = Counter(r['category'] for r in roles)
statuses = Counter(r['verification_status'] for r in resources)
assignments = sum(len(r['resource_ids']) for r in roles)
report = {'checked_at': '2026-09-15', 'valid': True, 'role_entries': len(roles), 'unique_resources': len(resources), 'skills': len(skills), 'sources': len(sources), 'role_resource_links': assignments, 'total_graph_edges': len(relations), 'categories': dict(overview), 'entry_types': dict(Counter(r['kind'] for r in roles)), 'resource_verification': dict(statuses), 'checks': ['ID 唯一', '资料主链接去重', '岗位/资料/技能/来源引用有效', '岗位父子结构无环', '每个岗位至少 3 份资料', '每份资料至少对应一个岗位', '核验状态完整'], 'limits': '检查数据结构与本轮链接核验记录；不代表运行了课程代码或认证了岗位职责。'}
dump('validation-report.json', report)

catalog = ['# AI 职位与对应学习资料', '', '> 采集于 2026-09-15。岗位摘要、分类、别名与资料顺序为编辑归纳。细分方向和行业变体不代表独立的新职业；资料不是雇主指定课程。', '', '[总览](README.md) · [全部学习资料](学习资料目录.md) · [来源与核验](来源目录.md)', '']
for category in overview:
    catalog.extend([f'## {category}', ''])
    for role in (r for r in roles if r['category'] == category):
        catalog.extend([f'<a id="{role["id"]}"></a>', '', f'### {role["id"]} · {role["name_zh"]}', '', f'**英文检索词**：{role["name_en"]}  ', f'**口径**：{KINDS[role["kind"]]}  ', f'**其他检索词**：{"、".join(role["aliases"])}', '', role['summary'], '', f'**关联技能**：{tags(role["skill_ids"])}', ''])
        if role['parent_id']:
            parent = role_by_id[role['parent_id']]
            catalog.extend([f'**所属主岗位／方向**：[{parent["name_zh"]}](#{parent["id"]})', ''])
        catalog.extend(['**学习资料（建议阅读顺序）**', ''])
        for i, rid in enumerate(role['resource_ids'], 1):
            resource = resource_by_id[rid]
            catalog.append(f'{i}. [{resource["title"]}]({resource["url"]}) · {resource["language"]} · {resource["level"]} · {STATUSES[resource["verification_status"]]}。{resource["description"]}。')
        catalog.extend(['', '**岗位证据**', ''])
        if role['source_ids']:
            for sid in role['source_ids']:
                source = source_by_id[sid]
                catalog.append(f'- [{source["organization"]}：{source["title"]}]({source["url"]})（{STATUSES[source["verification_status"]]}）')
        else:
            catalog.append('- 暂无独立招聘证据；以以上技术资料支持技能方向的存在。')
        catalog.extend(['', role['evidence_note'] + '。', ''])
md('岗位与资料目录.md', '\n'.join(catalog))

resource_doc = ['# 学习资料目录', '', '共 117 份去重资料。难度、前置知识和推荐理由为编辑判断；“已打开入口”不代表检查过所有章节、价格或代码可运行性。', '', '[岗位对应资料](岗位与资料目录.md) · [总览](README.md)', '', '| ID | 资料 | 语言 | 类型 / 难度 | 为什么看 | 核验 |', '|---|---|---|---|---|---|']
for r in resources:
    resource_doc.append(f'| {r["id"]} | [{safe(r["title"])}]({r["url"]}) | {r["language"]} | {r["type"]} / {r["level"]} | {safe(r["description"])} | {STATUSES[r["verification_status"]]} |')
resource_doc.extend(['', '## 访问受限与特别说明', ''])
for r in resources:
    if r['verification_status'] != 'page_opened' or r.get('original_url') or r.get('edition_note', '').startswith(('历史', '2023', '2025', 'AlphaFold')):
        resource_doc.append(f'- **{r["id"]} {r["title"]}**：{r["verification_note"]}。{r["edition_note"]}。')
resource_doc.extend(['', '## 按技能反查', ''])
for skill in skills:
    selected = [r for r in resources if skill['id'] in r['skill_ids']]
    resource_doc.append(f'- **{skill["name_zh"]}**：' + '；'.join(f'[{r["id"]} {r["title"]}]({r["url"]})' for r in selected))
md('学习资料目录.md', '\n'.join(resource_doc))

source_doc = ['# 岗位来源与核验记录', '', '官方招聘页用于确认出现过的岗位或方向，不用于推断招聘热度、薪资或目前是否仍在招聘。原网页和搜索索引可能存在时间差；“历史检索证据”须在正式发布前替换或明确展示。', '', '| ID | 来源 | 类型 | 核验 | 说明 |', '|---|---|---|---|---|']
for source in sources:
    source_doc.append(f'| {source["id"]} | [{safe(source["organization"] + " · " + source["title"])}]({source["url"]}) | {source["evidence_type"]} | {STATUSES[source["verification_status"]]} | {safe(source["verification_note"])} |')
md('来源目录.md', '\n'.join(source_doc))

readme = ['# AI 职业图谱知识库 · 第一轮资料采集', '', '**采集日期：2026-09-15**', '', f'整理了 **{len(roles)} 个岗位／方向条目、{len(resources)} 份去重学习资料、{len(skills)} 个技能主题、{len(sources)} 条岗位来源和 {assignments} 条岗位—资料关联**。', '', '这是首轮可编辑的数据底稿，不是招聘市场的穷尽清单。没有个人学习进度字段。', '', '## 从哪里看', '', '- [岗位与对应学习资料](岗位与资料目录.md)：逐个岗位查看定位、技能、资料和来源。', '- [全部学习资料](学习资料目录.md)：117 份资料及按技能反查索引。', '- [岗位来源](来源目录.md)：官方招聘、职业分类、实践文章与核验说明。', '- [完整 JSON 数据](knowledge-base.json)：后续网站可直接读取的种子数据。', '- [图谱关联数据](relations.json)：岗位父子关系、岗位技能、资料技能和推荐关系。', '- [校验结果](validation-report.json)：去重、引用和覆盖检查。', '', '## 覆盖范围', '', '| 板块 | 条目数 |', '|---|---:|']
for category, count in overview.items():
    readme.append(f'| {category} | {count} |')
readme.extend(['', '## 岗位条目的口径', '', '| 口径 | 数量 | 含义 |', '|---|---:|---|'])
kind_notes = {'role':'有官方招聘实例；中文为归一化名称。', 'specialization':'从岗位或招聘方向细分，不保证独立招聘。', 'practice_title':'企业实践文章中出现，不代表本次核实的在招岗位。', 'skill_direction':'根据技术主题编辑整理，暂缺独立招聘证据。', 'occupation':'国内正式职业口径。', 'occupation_subtype':'国内工种口径，与职业层级不同。', 'industry_variant':'主岗位在特定行业的变体。'}
for kind, count in Counter(r['kind'] for r in roles).items():
    readme.append(f'| {KINDS[kind]} | {count} | {kind_notes[kind]} |')
readme.extend(['', '**不能把这 80 条解释成 80 个互不重叠的“AI 新职业”。** FDE 并非因生成式 AI 才首次出现；传统机器学习、推荐、视觉等岗位也被纳入，便于完整浏览。英文别名是检索辅助，跨公司不保证严格等价。', '', '## 资料核验', '', '- 111 份：已打开资料入口。', '- 4 份：官方搜索结果确认，直接读取受限或为空壳。', '- 2 份：访问受限，保留为待复核入口（Elements of AI、ROS 2 Tutorials）。', '- 两个未获得可靠内容的候选已排除；LLM Universe 的在线版与仓库版已合并。', '- 页面可读不等于课程永久免费；视频播放、完整章节、证书、商业服务、API 和算力费用未逐项核实。', '- 仅整理链接与短介绍；资料再分发权限没有逐项审查。', '', '## 优先浏览的入口', ''])
for rid in ('P001','P002','P004','P005','P010','P013','P016','P025','P038','P048','P054','P064','P068'):
    r = role_by_id[rid]
    readme.append(f'- [{r["name_zh"]}](岗位与资料目录.md#{r["id"]})：{r["summary"]}。')
readme.extend(['', '## 数据结构', '', '| 文件 | 用途 |', '|---|---|', '| knowledge-base.json | 主数据，包含 metadata / roles / resources / skills / sources |', '| roles.json | 岗位名称、检索别名、口径、父岗位、技能、资料 ID、来源 ID |', '| resources.json | 资料标题、主链接、备用链接、语言、类型、难度、前置知识、核验说明 |', '| skills.json | 稳定技能 ID 与中文名称 |', '| sources.json | 岗位来源、证据类型、原链接、解析链接和核验说明 |', '| relations.json | 有类型的图谱边；推荐顺序是编辑建议，不是学习进度 |', '', '### 核心字段约定', '', '- `kind`：展示时必须保留，用于区分岗位、细分方向和工种。', '- `parent_id`：明确 FDE 行业变体、Agent 细分方向等层级，避免重复计数。', '- `verification_status`：核验状态，不是学习状态。', '- `checked_at` / `collected_at`：本轮访问或整理日期，不是内容发布日期。', '- `publication_date`：未逐条取得可靠发布日期，统一为 null；已知届次另记 `edition_note`。', '- `summary_basis` / `resource_mapping_basis`：明确编辑归纳与来源事实的边界。', '- `source_ids`：技能方向可为空；正式职位实例必须有依据。', '', '## 后续补充重点', '', '1. 中国公司岗位样本：部分招聘站为动态页面，本轮海外技术招聘证据较丰富，国内市场不能据此推断。', '2. 非技术岗位：内容运营、商业分析、采购与 AI 治理等方向仍需更多独立岗位证据和专业课程。', '3. 行业资料：医疗、法律和教育条目目前主要关联通用 AI 技术资料，不构成完整行业培养方案。', '4. 系统与机器人方向：集群网络、设备控制等需补充岗位特有的基础课程。', '5. 深度质量审阅：课程样章、项目可运行性、资料时效、中文翻译质量和许可需后续逐项审核。', '6. 论文阅读：本轮偏重可学习和可实践资料，研究前沿论文尚未系统收集。', '', '## 更新方式', '', '编辑 knowledge-base.json 后运行 `python3 research/ai-careers/build_catalog.py`，即可重新生成目录、拆分 JSON、关联数据、校验报告和 ZIP。', '', 'build_catalog.py 只生成本地研究资料，不会开发或发布网站。'])
md('README.md', '\n'.join(readme))

archive = ROOT.parent / 'AI职位与学习资料-2026-09-15.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted(ROOT.iterdir()):
        if path.is_file() and path.suffix in ('.json', '.md', '.py'):
            z.write(path, 'ai-careers/' + path.name)
print(json.dumps(report, ensure_ascii=False, indent=2))
print('Archive: ' + str(archive))
