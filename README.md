# 锐机超级搜索 v6

基于 React 18 + TypeScript + Vite + TailwindCSS 构建的智能搜索引擎前端，集成 AnySearch 搜索 API、GLM-4-Flash 大语言模型与基于**锐机智进**（自研自进化数据库技术）构建的热搜数据库 [RejHotSearchDB](https://github.com/RejTech/RejHotSearchDB)，提供搜索结果 AI 概括、AI 对话主导、多轮追问、热搜专家、嵌入式组件等能力。

## 核心功能

### 模式切换
- **三模式**：顶部滑块切换「搜索主导」「AI 对话主导」（BETA）与「锐机热搜专家」（NEW）
- **搜索主导**：经典搜索体验，结果列表 + 右侧详情面板
- **AI 对话主导**：自然语言对话，AI 自动提取关键词执行多次搜索并综合回答
- **锐机热搜专家**：基于 [RejHotSearchDB](https://github.com/RejTech/RejHotSearchDB) 归档，按日期/时间点浏览各平台热搜，点击热搜词条直接进入原有检索与 AI 工作流

### 锐机热搜专家（v6 新增）
> 本模块的热搜数据由 [RejHotSearchDB](https://github.com/RejTech/RejHotSearchDB) 提供，该库基于**锐机智进数据库技术**（自研自进化数据库，与本搜索前端 rejsearch 为相互独立的技术体系）构建。
- **热搜数据源**：对接 `RejTech/RejHotSearchDB` 定时归档的 JSON 数据，覆盖微博、知乎、百度、哔哩哔哩、抖音、今日头条六个平台（单平台抓取失败不影响其他平台）
- **日期/时间点选择**：下拉菜单选择归档日期（默认最新日期）与当天抓取时间点（默认最新时间点），索引键直接来自数据端，不做任何前端时区加工
- **平台榜单**：双列卡片展示各平台热搜，浅蓝色圆形序号、热度值（过万自动转「万」）与「热/新/置顶」标签；每平台默认展示前 10 条，可展开全部
- **进入原工作流**：
  - 点击热搜词条 → 以热搜原词执行 AnySearch 搜索，复用结果列表、AI 总体概括、详情面板与 AI 追问的完整流程
  - 选中词条后可「针对该热搜详细提问」，搜索词恒为「热搜原词 + 问题」（如 `迪拜航空确认航班发生事故 最新进展`），确保搜索结果与对应热搜强相关
- **数据可靠性**：热搜请求走同源加速节点，**进入页面时自动对 GitHub Raw 直连、gh-proxy.com 公益加速、jsDelivr Fastly、jsDelivr Gcore 四个节点并发测速**（请求极小的 index.json，8 秒超时），后续优先使用实测延迟最低的节点；最快节点请求失败时自动降级到次快节点（单节点重试 2 次），会话内连续失败的节点临时沉底。测速结果缓存于 localStorage（30 分钟有效），控制栏实时显示当前节点与延迟（悬停可看全部节点测速结果），并可点击「重新测速」手动刷新；归档在前端进程内缓存，切换日期/时间点不重复请求
- **可启用/禁用**：主页模式常驻；内嵌页通过 `hotsearch=false` 参数或定制弹窗开关关闭
- **技术来源标注**：专家页面（榜单视图与进入检索后的工作流视图）底部固定展示「基于锐机智进数据库技术构建」

### 搜索体验
- **智能检索**：接入 AnySearch API，支持自然语言搜索
- **搜索历史**：聚焦时展开、点击或失焦自动收起，带平滑动画
- **结果分页**：每页 10 条结果，支持翻页导航
- **响应式布局**：桌面端右侧详情面板，移动端底部弹窗详情

### AI 能力（GLM-4-Flash）
- **总体概括**：搜索完成后流式生成 200-500 字综合摘要，引用标记 `[N]` / `[1,2,3]` 渲染为可点击蓝色徽章，点击跳转对应结果详情
- **单条追问**：基于某条结果的完整原文开启多轮对话窗口，支持 Markdown 渲染（代码块、表格、列表等）
- **综合追问**：基于全部搜索结果开启多轮对话，回答中的引用徽章同样可点击跳转
- **AI 对话主导**：自动提取搜索关键词、并行多次搜索、流式综合回答；搜索步骤可下拉展开查看每条结果
- **热搜模式联动**：热搜专家模式下的搜索结果同样触发 AI 总体概括，并支持详情摘要与全部追问能力
- **逐字浮入动画**：AI 输出按流式进度逐字浮现，末尾带闪烁光标
- **许可证解析**：使用 GLM 解析 GPLv3 许可证，区分「允许做」与「不允许做」
- **超时与中断**：GLM 调用支持 AbortSignal 中断，60 秒首响应超时自动失败；"停止"按钮真正中断流式请求

### AI 生成内容水印（强制）
为避免 AI 生成内容被误用为权威来源，所有 AI 输出容器均叠加斜向「AI生成 仅供参考」水印：
- AI 对话气泡
- AI 总体概括框
- 单条结果 AI 摘要（桌面详情面板 + 移动端弹窗）
- AI 追问窗口的回复消息
- 许可证 AI 解析结果

水印为合规设计，**强制显示，不支持在内嵌定制中关闭**。

### 多页面架构
- **`/` 主页**：完整搜索体验，含三模式切换、定制内嵌部件入口、主题切换、许可证按钮
- **`/ask` 精简页**：仅搜索框 + 底栏，支持 `?s=关键词` 自动搜索
- **`/embed` 内嵌页**：通过 URL 参数控制显示内容，适合集成到第三方页面

### 内嵌部件定制
主页底栏「定制内嵌部件」按钮可配置以下功能并生成嵌入链接：
- 是否显示标题和副标题
- 是否允许内嵌页面内搜索（关闭则跳转主页）
- 是否显示 GLM-4 摘要
- 是否允许 AI 追问
- 是否显示锐机热搜专家（依赖内嵌搜索能力，关闭内嵌搜索时自动隐藏）
- 是否显示许可证信息
- 是否显示版本号

> 注：AI 生成内容水印为强制项，不在此定制列表中。

### 主题系统
- 三态切换：浅色 / 深色 / 跟随系统（auto）
- 系统主题变化时实时同步（auto 模式）
- 选择持久化到 localStorage，防 FOUC 内联脚本

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript 5.8 |
| 构建 | Vite 6 |
| 样式 | TailwindCSS 3.4（`darkMode: "class"`） |
| 状态 | Zustand 5 |
| 路由 | React Router 7 |
| Markdown | react-markdown + remark-gfm |
| AI | GLM-4-Flash（智谱 BigModel） |
| 搜索 | AnySearch API |
| 热搜数据 | RejHotSearchDB（GitHub Raw / gh-proxy / jsDelivr 四节点自动测速） |
| 部署 | Netlify（含边缘代理与 SPA 回退） |

## 快速开始

### 环境要求
- Node.js 18+
- npm 或其他包管理器

### 安装与运行
```bash
npm install
npm run dev
```
开发服务器启动后访问 `http://localhost:5173`。

### 构建
```bash
npm run build
```
构建产物输出到 `dist/` 目录，可直接部署到任意静态托管服务。

### 类型检查
```bash
npm run check
```

## 项目结构

```
src/
├── components/
│   ├── SearchBar.tsx          # 搜索框、历史、自动搜索
│   ├── SearchResults.tsx      # 结果列表、详情、AI 概括、追问窗口、Markdown 渲染
│   ├── ChatMode.tsx           # AI 对话主导模式（多轮搜索 + 流式回答 + 步骤展开）
│   ├── HotSearchExpert.tsx    # 锐机热搜专家（日期/时间点选择 + 平台榜单 + 进入检索工作流）
│   ├── LicenseButton.tsx      # 许可证按钮与 GLM 解析弹窗
│   ├── Watermark.tsx          # 斜向重复文字水印组件（AI 生成内容合规标识）
│   └── ThemeToggle.tsx        # 三态主题切换按钮
├── pages/
│   ├── Home.tsx               # 主页（三模式切换 + 内嵌部件定制弹窗）
│   ├── Ask.tsx                # 精简搜索页（?s= 自动搜索）
│   └── Embed.tsx              # 内嵌页（URL 参数配置 + 搜索/热搜标签切换）
├── store/
│   ├── searchStore.ts         # 搜索状态（结果、历史、GLM 摘要流式）
│   └── themeStore.ts          # 主题状态（light/dark/auto + 系统监听）
├── lib/
│   ├── anysearch.ts           # AnySearch API 客户端（含 tag 重试）
│   ├── glm.ts                 # GLM-4-Flash 流式调用（概括/追问/许可证/对话，支持 AbortSignal）
│   ├── hotsearch.ts           # RejHotSearchDB 客户端（索引/归档、三数据源回退、归档缓存）
│   └── embedConfig.ts         # 内嵌配置解析与 URL 生成
├── App.tsx                    # 路由配置
├── main.tsx                   # 应用入口
└── index.css                  # 全局样式与动画
```

## 配置说明

### AnySearch API
- 端点：`/api/anysearch`（同源代理，绕过浏览器 CORS）
- 开发环境：Vite dev server proxy 转发到 `https://api.anysearch.com/v1/search`
- 生产环境：Netlify 边缘代理（见 `public/_redirects`）
- 请求需携带 `extract_content: true` 以获取正文内容
- 响应格式：`{ code: 0, message: "success", data: { results: [...] } }`
- `max_results` 上限 20，前端分页每页 10 条

### 锐机热搜库（RejHotSearchDB，基于锐机智进数据库技术）
> RejHotSearchDB 是独立的热搜归档库，基于自研的锐机智进（自进化数据库）技术构建；rejsearch 仅作为前端消费其 JSON 归档。
- 数据格式（见[数据仓库 README](https://github.com/RejTech/RejHotSearchDB)）：
  - 索引：`archives/index.json` → `{ updated, dates: { "YYYY-MM-DD": ["HH-mm", ...] } }`
  - 归档：`archives/{date}/{time}.json` → `{ date, time, timestamp, platforms: { weibo: { success, list: [...] }, ... } }`
- 同源加速节点（自动测速后按延迟升序选择，失败自动降级）：

| 前端同源路径 | 实际节点 |
|----------|----------|
| `/api/hotsearch-raw/*` | `https://raw.githubusercontent.com/RejTech/RejHotSearchDB/main/archives/*`（GitHub 直连，内容最新） |
| `/api/hotsearch-ghproxy/*` | `https://gh-proxy.com/https://raw.githubusercontent.com/RejTech/RejHotSearchDB/main/archives/*`（公益加速） |
| `/api/hotsearch-fastly/*` | `https://fastly.jsdelivr.net/gh/RejTech/RejHotSearchDB@main/archives/*`（jsDelivr Fastly） |
| `/api/hotsearch-gcore/*` | `https://gcore.jsdelivr.net/gh/RejTech/RejHotSearchDB@main/archives/*`（jsDelivr Gcore） |

- 自动测速策略（实现见 `src/lib/hotsearch.ts`）：
  1. 首次使用时并发请求四个节点的 `index.json`（`cache: no-store`，单节点 8 秒超时），以完整收到响应的耗时作为延迟；
  2. 可用节点按延迟升序排列，失败节点沉尾；结果写入 localStorage（键 `hotsearch_node_rank_v1`，30 分钟有效）；
  3. 索引与归档请求按测速顺序依次尝试，单节点最多 2 次（间隔 350ms），全部失败才报错；会话内连续失败的节点临时沉底，重新测速后恢复；
  4. 控制栏提供「重新测速」按钮，可随时跳过缓存强制重测；四个节点全部测速失败时，按上表声明顺序兜底尝试。
- 开发环境：Vite dev server proxy；生产环境：Netlify 边缘代理（见 `public/_redirects`）
- 归档保留最近 30 天，由数据仓库的 GitHub Actions 每小时抓取并重建索引

### GLM-4-Flash
- 端点：`https://open.bigmodel.cn/api/paas/v4/chat/completions`
- 模型：`glm-4-flash`
- 参数：`temperature: 0.3`，`max_tokens: 1200`，`stream: true`
- 支持 CORS，前端直连
- 流式调用支持 `AbortSignal` 中断；首响应 60 秒超时自动失败

### Netlify 部署
- 构建命令：`npm run build`
- 发布目录：`dist`
- `public/_redirects` 配置：
  - `/api/anysearch/*` → 代理到 AnySearch API（状态码 200）
  - `/api/hotsearch-raw/*`、`/api/hotsearch-ghproxy/*`、`/api/hotsearch-fastly/*`、`/api/hotsearch-gcore/*` → 代理到热搜库四个加速节点（状态码 200），由前端自动测速选择最快节点
  - `/*` → 回退到 `index.html`（SPA 路由）

## 嵌入式集成示例

```html
<!-- 基础嵌入 -->
<iframe src="https://your-domain/embed" width="100%" height="600"></iframe>

<!-- 定制：隐藏标题与版本号，禁用内嵌搜索 -->
<iframe src="https://your-domain/embed?title=false&version=false&search=false"
        width="100%" height="600"></iframe>

<!-- 定制：仅保留搜索，隐藏热搜专家标签 -->
<iframe src="https://your-domain/embed?hotsearch=false"
        width="100%" height="600"></iframe>
```

可用的 URL 参数（未指定默认为 `true`）：

| 参数 | 说明 |
|------|------|
| `title=false` | 隐藏标题与副标题 |
| `search=false` | 禁用内嵌搜索（点击搜索跳转主页；同时自动隐藏热搜专家标签） |
| `glm=false` | 隐藏 GLM-4 摘要 |
| `followup=false` | 禁用 AI 追问功能 |
| `hotsearch=false` | 隐藏锐机热搜专家标签 |
| `license=false` | 隐藏许可证按钮 |
| `version=false` | 隐藏版本号 |

> AI 生成内容水印为合规强制项，无法通过 URL 参数关闭。

## 许可证

本项目基于 GPL-3.0 许可证开源，详见 [LICENSE](./LICENSE)。
