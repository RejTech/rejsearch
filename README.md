# 锐机超级搜索 v6

基于 React 18 + TypeScript + Vite + TailwindCSS 构建的智能搜索引擎前端，集成 AnySearch 搜索 API、GLM-4-Flash 大语言模型与基于**锐机智进**（自研自进化数据库技术）构建的热搜数据库 [RejHotSearchDB](https://github.com/RejTech/RejHotSearchDB)，提供搜索结果 AI 概括、AI 自搜、热搜专家、嵌入式组件等能力。

## 核心功能

### 模式切换
- **三模式**：顶部滑块切换「搜索主导」「AI 自搜」（BETA）与「锐机热搜专家」（NEW）
- **搜索主导**：经典搜索体验，结果列表 + 右侧详情面板
- **AI 自搜**：一次提问，AI 自动提取关键词执行多次搜索并综合回答；再次提问自动开启新会话（发送前上一次结果保持显示）
- **锐机热搜专家**：基于 [RejHotSearchDB](https://github.com/RejTech/RejHotSearchDB) 归档，按日期/时间点浏览各平台热搜，点击热搜词条直接进入原有检索与 AI 工作流

### 锐机热搜专家（v6 新增）
> 本模块的热搜数据由 [RejHotSearchDB](https://github.com/RejTech/RejHotSearchDB) 提供，该库基于**锐机智进数据库技术**（自研自进化数据库，与本搜索前端 rejsearch 为相互独立的技术体系）构建。
- **热搜数据源**：对接 `RejTech/RejHotSearchDB` 定时归档的 JSON 数据，覆盖 **AIHOT 热榜（置顶展示）**、微博、知乎、百度、哔哩哔哩、抖音、今日头条七个平台（单平台抓取失败不影响其他平台）；AIHOT 汇聚各大 AI 厂商官方 Blog/RSS 资讯，条目标签即来源名称
- **日期/时间点选择**：下拉菜单选择归档日期（默认最新日期）与当天抓取时间点（默认最新时间点），索引键直接来自数据端，不做任何前端时区加工
- **平台榜单**：双列卡片展示各平台热搜，浅蓝色圆形序号、热度值（过万自动转「万」）与「热/新/置顶」标签；每平台默认展示前 10 条，可展开全部
- **进入原工作流**：
  - 点击热搜词条 → 以热搜原词执行 AnySearch 搜索，复用结果列表、AI 总体概括与详情面板的完整流程
  - 选中词条后可「针对该热搜详细提问」，搜索词恒为「热搜原词 + 问题」（如 `迪拜航空确认航班发生事故 最新进展`），确保搜索结果与对应热搜强相关
- **数据可靠性**：热搜请求走同源加速节点，**进入页面时自动对 GitHub Raw 直连、gh-proxy.com 公益加速、jsDelivr Gcore 三个节点并发探测**（请求极小的 index.json，8 秒超时）。节点选择**数据新鲜度优先、实测延迟次之**：以各节点索引的 `updated` 时间戳为准，返回最新索引的节点排在前面（规避 CDN 边缘缓存导致的信息差），新鲜度相同再比延迟；最快/最新节点请求失败时自动降级到次选节点（单节点重试 2 次），会话内连续失败的节点临时沉底。测速结果缓存于 localStorage（30 分钟有效），**索引本身每次进入热搜专家都强制 `no-store` 重新拉取**；控制栏实时显示当前节点与延迟（悬停可看全部节点延迟与「最新/数据滞后」标注），并可点击「重新测速」手动刷新；归档在前端进程内缓存，切换日期/时间点不重复请求
- **可启用/禁用**：主页模式常驻；内嵌页通过 `hotsearch=false` 参数或定制弹窗开关关闭
- **技术来源标注**：专家页面（榜单视图与进入检索后的工作流视图）底部固定展示「基于锐机智进数据库技术构建」

### 搜索体验
- **智能检索**：接入 AnySearch API，支持自然语言搜索
- **搜索历史**：聚焦时展开、点击或失焦自动收起，带平滑动画
- **结果分页**：每页 10 条结果，支持翻页导航
- **响应式布局**：桌面端右侧详情面板，移动端底部弹窗详情

### 移动端 WAP 界面（v6 新增）
> 手机不再使用桌面自适应布局（过窄过挤），而是自动进入为手机重新设计的专属界面。
- **自动分流**：基于 UA（含 iPadOS 特判，桌面窄窗口不触发）——移动设备访问主页自动跳转 `/wap`，桌面设备访问 `/wap` 自动回到主页；URL 添加 `?force` 参数可跳过分流，便于桌面调试预览 WAP 界面
- **App 式结构**：三个模式（搜索 / AI 自搜 / 热搜）改为**底部悬浮标签栏**，白底圆角胶囊 + 滑动高亮药丸，贴合 iPhone 安全区（`env(safe-area-inset-*)`）
- **LiquidGlass 风格**：底栏采用轻量高斯模糊毛玻璃（`backdrop-blur(10px)` + 适度饱和度提升、高透底色）、细描边与顶部内高光；浅色/深色主题各自适配（主题跟随系统，页面内不设切换按钮）
- **移动端交互**：无顶栏干扰，内容直接满宽铺开；结果详情走底部弹窗
- **热搜顶部悬浮控制**：榜单视图左上角固定「选择时间」「高级选项」两个玻璃胶囊——「选择时间」面板收纳日期/时间点、**GitHub Actions 抓取状态徽章**（绿/红/黄实时状态 + 相对时间，点击跳转运行页）与刷新数据；「高级选项」收纳节点状态/重新测速/刷新数据，以及「下载索引」「下载本期」（导出 index.json 与当前日期时间点归档 JSON）；面板互斥展开、点外部收起、带滑落展开动画；工作流视图左上「‹ 返回热搜榜」、右上「平台原页 ↗」两个对称悬浮胶囊
- **音效反馈**：底栏切换模式播放 lift 音效；AI 自搜与结果页追问回答完成时播放 perk 提示音（停止/失败不响）
- **WAP 自搜模式**：无顶部栏，消息区满宽玻璃气泡（AI 回复半透明白底 + 毛玻璃，用户深色气泡，浮入动画），搜索步骤折叠/引用徽章/水印保留；输入框为底部固定 LiquidGlass 单行药丸（透明输入 + 深色胶囊发送/停止，与底栏同构），「清空对话」为右上角小胶囊；消息随页面流滚动
- **同心圆角**：WAP 弹层（下拉面板等）容器圆角与内部胶囊/气泡按同心圆规则取值（容器 32px = 内边距 + 内层 20~22px 胶囊圆角），圆弧共用圆心
- **热搜折叠弹窗**：WAP 热搜专家中各平台默认折叠为一行卡片，卡片中部为 **AI（GLM）整榜一句话概览**（涉及哪些圈子/产品/人物，带「AI」小徽标，失败自动回退为「首条标题 等 N 条」）；点击后以底部弹窗（bottom sheet）展开该平台完整榜单，点击词条直接进入检索工作流；桌面端保持双列卡片形态

### AI 追问（v6 恢复）
- 搜索/热搜检索结果生成完后可**基于当前结果多轮追问**：移动端为底栏上方「追问」药丸（点击展开追问栏），桌面端为「AI 总体概括」卡右上角「AI 追问」按钮（打开居中模态）
- AI 回答流式输出、支持 Markdown 与引用徽章；新搜索自动重置追问会话（AI 自搜模式保持单次会话不变）

### AI 能力（GLM-4-Flash）
- **总体概括**：搜索完成后流式生成 200-500 字综合摘要，引用标记 `[N]` / `[1,2,3]` 渲染为可点击蓝色徽章，点击跳转对应结果详情
- **AI 自搜**：单次会话内自动提取搜索关键词、多次搜索、流式综合回答；搜索步骤可下拉展开查看每条结果；再次提问自动开启新会话
- **热搜模式联动**：热搜专家模式下的搜索结果同样触发 AI 总体概括，并支持详情摘要
- **逐字浮入动画**：AI 输出按流式进度逐字浮现，末尾带闪烁光标
- **许可证解析**：使用 GLM 解析 GPLv3 许可证，区分「允许做」与「不允许做」
- **超时与中断**：GLM 调用支持 AbortSignal 中断，60 秒首响应超时自动失败；"停止"按钮真正中断流式请求

### AI 生成内容水印（强制）
为避免 AI 生成内容被误用为权威来源，所有 AI 输出容器均叠加斜向「AI生成 仅供参考」水印：
- AI 自搜回答气泡
- AI 总体概括框
- 单条结果 AI 摘要（桌面详情面板 + 移动端弹窗）
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
│   ├── SearchResults.tsx      # 结果列表、详情、AI 概括、Markdown 渲染
│   ├── ChatMode.tsx           # AI 自搜模式（单次会话：多轮搜索 + 流式回答 + 步骤展开）
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
│   ├── glm.ts                 # GLM-4-Flash 流式调用（概括/许可证/自搜对话，支持 AbortSignal）
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
- 同源加速节点（自动探测后按「索引新鲜度 → 延迟」排序选择，失败自动降级）：

| 前端同源路径 | 实际节点 |
|----------|----------|
| `/api/hotsearch-raw/*` | `https://raw.githubusercontent.com/RejTech/RejHotSearchDB/main/archives/*`（GitHub 直连，内容最新） |
| `/api/hotsearch-ghproxy/*` | `https://gh-proxy.com/https://raw.githubusercontent.com/RejTech/RejHotSearchDB/main/archives/*`（公益加速） |
| `/api/hotsearch-gcore/*` | `https://gcore.jsdelivr.net/gh/RejTech/RejHotSearchDB@main/archives/*`（jsDelivr Gcore） |

- 自动探测与选路策略（实现见 `src/lib/hotsearch.ts`）：
  1. 首次使用时并发请求三个节点的 `index.json`（`cache: no-store`，单节点 8 秒超时），记录完整响应耗时与索引自报的 `updated` 时间戳；
  2. 排序规则：可用节点先按 `updated` 倒序（**数据新鲜度优先，jsDelivr 等 CDN 缓存滞后时即使延迟最低也靠后**），`updated` 相同再按延迟升序；失败节点沉尾；
  3. 排序结果写入 localStorage（键 `hotsearch_node_rank_v2`，30 分钟有效），节点列表变更自动作废；
  4. 每次进入热搜专家，索引请求强制 `no-store` 并附带时间戳参数，保证拿到最新日期/时间点列表；归档请求按探测顺序逐节点尝试，单节点最多 2 次（间隔 350ms），全部失败才报错；会话内连续失败的节点临时沉底，重新测速后恢复；
  5. 控制栏提供「重新测速」按钮，可随时跳过缓存强制重测（tooltip 标注各节点「最新/数据滞后」）；三个节点全部探测失败时，按上表声明顺序兜底尝试。
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
  - `/api/hotsearch-raw/*`、`/api/hotsearch-ghproxy/*`、`/api/hotsearch-gcore/*` → 代理到热搜库三个加速节点（状态码 200），由前端按「索引新鲜度优先、延迟次之」自动选路
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
| `hotsearch=false` | 关闭热搜专家标签 |
| `license=false` | 隐藏许可证按钮 |
| `version=false` | 隐藏版本号 |

> AI 生成内容水印为合规强制项，无法通过 URL 参数关闭。

## 许可证

本项目基于 GPL-3.0 许可证开源，详见 [LICENSE](./LICENSE)。
