# AI POSITION

Git 驱动的 AI 职位与学习资料知识库。深色职业地图前台，YAML 内容文件，GitHub Issue / PR 协作，无管理后台和业务数据库。

当前种子：80 个岗位与方向、118 份学习资料、83 个技能主题、56 条岗位来源。网站从 `content/` 构建；新增内容不需要改页面代码。

## 本地运行

需要 Node.js 22 或更高版本。

```sh
npm ci --ignore-scripts
npm run dev
```

打开 `http://127.0.0.1:4321/`。修改 `content/`、`src/`、`scripts/` 或 `site.config.json` 后自动重建，刷新浏览器查看结果。

```sh
npm run validate       # 内容、重复链接与跨文件引用检查
npm test               # 结构、公开数据隔离、搜索和链接安全测试
npm run build          # 生成 dist/，检查静态内部链接
npm run check          # 上述完整检查
```

浏览器测试：

```sh
npx playwright install chromium
npm run test:browser
```

若本机已安装 Chrome，可用 `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`。测试会复用 4321 端口的预览，或自行启动。

## 如何添加内容

阅读 [贡献指南](CONTRIBUTING.md) 和 [内容字段说明](docs/content-model.md)。

- 一个岗位：`content/roles/Pxxx.yaml`。
- 一份资料：`content/resources/Rxxx.yaml`。
- 一个技能：`content/skills/skill-id.yaml`。
- 一条岗位来源：`content/sources/source-id.yaml`。
- 板块与顺序：`content/categories.yaml`。

一份资料可被多个岗位引用；岗位 `resources` 数组的顺序就是推荐顺序。不要手改 `dist/` 或原始研究 JSON 来更新网站。

## 连接 GitHub 仓库

本项目仓库：[mocaii/AIPosition](https://github.com/mocaii/AIPosition)。网站地址：[AI POSITION](https://mocaii.github.io/AIPosition/)。

如需部署自己的副本：

1. 在 GitHub 创建目标仓库，并将本项目推送过去。
2. 在 `site.config.json` 填入 `repository`，例如 `https://github.com/你的账户/你的仓库`。本地也可从 Git `origin` 自动识别，GitHub Actions 从运行环境识别。
3. 仓库开启 Issues，使推荐和纠错模板可用。
4. 在 **Settings → Pages → Build and deployment** 选择 **GitHub Actions**。
5. 默认分支提交通过检查后，`Publish GitHub Pages` 工作流部署网站。

仓库名称、分支与子路径都可配置。GitHub Pages 工作流自动读取真实 `base_path` 和 `base_url`，支持 `用户名.github.io/仓库名/`。自定义域名按 Pages 设置操作。

GitHub Pages 是否可用于私有仓库取决于账户方案；公开前请确认仓库中的研究和设计文件适合公开。

### 构建配置

| 配置 | 用途 |
|---|---|
| `repository` / `SITE_REPOSITORY` | GitHub 仓库地址，生成 Issue、编辑与历史链接 |
| `branch` / `SITE_BRANCH` | 内容编辑分支，默认 main |
| `basePath` / `BASE_PATH` | 部署子路径，例如 /AIPosition；根域名留空 |
| `siteUrl` / `SITE_URL` | 完整网站地址，包含子路径；设置后生成 canonical 与 sitemap |

环境变量优先于配置文件。`.env.example` 仅说明变量，脚本不隐式加载 `.env`。无仓库地址时，贡献按钮跳转说明页，不生成虚假的远程链接。

## 自动化协作

- `check.yml`：PR / push 校验内容、测试、构建，上传 `site-preview` 构建包。
- `deploy.yml`：默认分支通过检查后发布 GitHub Pages；PR 不具备发布权限。
- `links.yml`：每周检查公开学习资料的链接，上传报告，并创建或更新同一个维护 Issue。

**PR 当前提供可下载的静态预览包，并未开通每个 PR 的独立在线预览地址。** 下载 artifact 后可在解压目录启动静态文件服务查看。默认分支通过检查后自动更新正式 Pages 站点。

外部站点超时、403、429 不阻止 PR 构建，也不会自动把资料删除。定时链接检查仅报告当前请求结果，维护者确认后在 YAML 中修改核验记录。

## 页面与交互

- 首页：80 个条目的真实分类、类型筛选、中文/英文/别名搜索、跨类型资料与技能结果。
- 岗位：桌面抽屉展开、可直接访问的完整页面、资料筛选、父子方向、来源说明。
- 资料：语言/难度/类型/技能组合筛选，独立详情，原站访问与纠错入口。
- 技能：主题目录和关联岗位/资料；首页局部图谱展示真实的共享技能边。
- 移动端：单列卡片、横向板块筛选和完整岗位页面。
- 搜索与筛选保存在 URL；详情关闭恢复原搜索状态。
- `draft` 和 `archived` 内容不生成公开页面，也不进入搜索索引或关联数量。

所有主要正文在构建时生成 HTML，关闭 JavaScript 仍可浏览页面和访问资料。JavaScript 负责搜索、筛选和抽屉。字体有本地回退，Google Fonts 不可访问时仍可使用。

## 目录

```text
content/                人工维护的线上内容源
src/assets/             样式、浏览器交互与图标
scripts/                导入、校验、构建、预览、链接检查
tests/                  内容测试与浏览器测试
.github/                Issue 模板、PR 模板、CI/CD
docs/                   维护与技术说明
research/               原始研究快照与资料包
design/                 设计方案、历史方案和视觉稿
dist/                   自动生成的静态网站，忽略提交
```

首轮导入脚本 `npm run import:seed` 只创建缺失文件，不覆盖已存在 YAML。它面向首次迁移；删除过的原始条目再次运行该脚本会被重新创建，因此日常维护不需要运行。

## 范围说明

岗位分类和推荐理由为编辑归纳，保留来源与核验口径。引用链接不代表获得原资料的再分发许可。本项目尚未确定统一开源许可证，贡献者提交内容时应明确有权提交；外部资料优先保留链接与原创简介。

旧的 `design/technical-architecture.md` 是已放弃的 CMS 方案；现行架构见 [Git 架构说明](docs/architecture.md)。
