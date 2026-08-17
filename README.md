# 锐机超级搜索 v5

基于 React 18 + TypeScript + Vite + TailwindCSS 构建的智能搜索引擎前端，集成 AnySearch 搜索 API 与 GLM-4-Flash 大语言模型，提供搜索结果 AI 概括、AI 对话主导、多轮追问、嵌入式组件等能力。

## 核心功能

### 模式切换
- **双模式**：顶部滑块切换「搜索主导」与「AI 对话主导」（BETA）
- **搜索主导**：经典搜索体验，结果列表 + 右侧详情面板
- **AI 对话主导**：自然语言对话，AI 自动提取关键词执行多次搜索并综合回答

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
- **`/` 主页**：完整搜索体验，含模式切换、定制内嵌部件入口、主题切换、许可证按钮
- **`/ask` 精简页**：仅搜索框 + 底栏，支持 `?s=关键词` 自动搜索
- **`/embed` 内嵌页**：通过 URL 参数控制显示内容，适合集成到第三方页面

### 内嵌部件定制
主页底栏「定制内嵌部件」按钮可配置以下功能并生成嵌入链接：
- 是否显示标题和副标题
- 是否允许内嵌页面内搜索（关闭则跳转主页）
- 是否显示 GLM-4 摘要
- 是否允许 AI 追问
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
│   ├── LicenseButton.tsx      # 许可证按钮与 GLM 解析弹窗
│   ├── Watermark.tsx          # 斜向重复文字水印组件（AI 生成内容合规标识）
│   └── ThemeToggle.tsx        # 三态主题切换按钮
├── pages/
│   ├── Home.tsx               # 主页（模式切换 + 内嵌部件定制弹窗）
│   ├── Ask.tsx                # 精简搜索页（?s= 自动搜索）
│   └── Embed.tsx              # 内嵌页（URL 参数配置）
├── store/
│   ├── searchStore.ts         # 搜索状态（结果、历史、GLM 摘要流式）
│   └── themeStore.ts          # 主题状态（light/dark/auto + 系统监听）
├── lib/
│   ├── anysearch.ts           # AnySearch API 客户端（含 tag 重试）
│   ├── glm.ts                 # GLM-4-Flash 流式调用（概括/追问/许可证/对话，支持 AbortSignal）
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
  - `/*` → 回退到 `index.html`（SPA 路由）

## 嵌入式集成示例

```html
<!-- 基础嵌入 -->
<iframe src="https://your-domain/embed" width="100%" height="600"></iframe>

<!-- 定制：隐藏标题与版本号，禁用内嵌搜索 -->
<iframe src="https://your-domain/embed?title=false&version=false&search=false"
        width="100%" height="600"></iframe>
```

可用的 URL 参数（未指定默认为 `true`）：

| 参数 | 说明 |
|------|------|
| `title=false` | 隐藏标题与副标题 |
| `search=false` | 禁用内嵌搜索（点击搜索跳转主页） |
| `glm=false` | 隐藏 GLM-4 摘要 |
| `followup=false` | 禁用 AI 追问功能 |
| `license=false` | 隐藏许可证按钮 |
| `version=false` | 隐藏版本号 |

> AI 生成内容水印为合规强制项，无法通过 URL 参数关闭。

## 许可证

本项目基于 GPL-3.0 许可证开源，详见 [LICENSE](./LICENSE)。
