# 内容字段与约束

文件使用 YAML，UTF-8 编码。稳定 ID 用于关联；slug 用于 URL。草稿也必须符合结构和引用约束，但不会出现在公开网站。

## 通用

- `id`：以字母开头，只含字母、数字、下划线、短横线。文件名为 `<id>.yaml`。
- `status`：`draft` / `published` / `archived`。
- 同一集合内 ID 唯一，岗位与资料各自的 slug 唯一。
- `collected_at`：采集日期；`checked_at`：检查日期。未知发布日期为 null。
- YAML 重复键报错，避免静默覆盖。

## roles

必需字段：`id`、`status`、`slug`、`name_zh`、`name_en`、`summary`、`category`、`kind`、`aliases`、`skill_ids`、`source_ids`、`resources`。

`aliases`、`skill_ids`、`source_ids` 均为字符串数组；`resources` 为 `{id, reason}` 数组，`reason` 可为空字符串。`parent_id` 可为空。

kind 枚举：

| 值 | 展示口径 |
|---|---|
| role | 有招聘依据的岗位实例 |
| specialization | 岗位细分方向 |
| practice_title | 企业实践称谓 |
| skill_direction | 编辑整理的技能方向 |
| occupation | 国内职业 |
| occupation_subtype | 国内工种 |
| industry_variant | 行业变体 |

`summary_basis`、`resource_mapping_basis`、`evidence_note` 可补充编辑口径说明。已发布 `role` 至少提供一条 source 引用。关联不足时允许展示待补充状态，不强行编造资料。

## resources

必需字段：`id`、`status`、`slug`、`title`、`url`、`publisher`、`type`、`language`、`level`、`description`、`skill_ids`、`verification_status`。

- `level`：入门 / 基础 / 进阶 / 高级。
- `type`：可用官方文档、开源教程、开源项目、大学课程等，筛选项从内容自动生成。
- `language`：推荐中文、英文、中英双语、英文/多语言等一致写法。中文筛选匹配“中文”或“中英”；英文筛选匹配“英文”。
- `alternate_urls`：同一资料的备用访问地址，不重复建立资料条目。
- `prerequisites`：前置知识。
- `edition_note`：课程年份或依赖版本提示。
- `access_note`：登录、收费、API / 算力等已知访问说明。
- `verification_note`：本次核验范围与限制。

URL 标准化用于查重：移除片段和常见跟踪参数，保留实际业务参数。不同域名的镜像由人工判断，不自动合并。

## skills / sources / categories

- 技能：`id`、`name_zh`、`status`。
- 来源：`id`、`title`、`organization`、`url`、`evidence_type`、`verification_status`、`status`；建议同时填写 `verification_note` 和 `checked_at`。
- 板块在 `categories.yaml` 数组中：`id`、`name`、`order`。

## 核验状态

| 值 | 含义 |
|---|---|
| page_opened | 入口已打开，不代表完整课程通过审核 |
| search_result_confirmed | 仅搜索结果有依据 |
| fetch_blocked | 本次访问受限，需要补充核验 |
| historical_search_evidence | 仅保留历史检索依据 |

定时链接检查的 reachable / restricted / not_found / temporary_error 仅在报告中使用，不自动替换以上人工记录。
