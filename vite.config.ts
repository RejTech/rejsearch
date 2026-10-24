import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { readFileSync } from 'node:fs'

// 版本号单一来源：package.json
const appVersion = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }).version
const versionJson = JSON.stringify({ name: 'RemoSearch', version: appVersion })

// 暴露 /version.json：开发环境走中间件，生产构建发射为静态资源（Netlify 直接可访问），
// 供 RWACore 等外部容器读取当前版本
const versionJsonPlugin = (): Plugin => ({
  name: 'version-json',
  configureServer(server) {
    server.middlewares.use('/version.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(versionJson)
    })
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: versionJson })
  },
})

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: 'hidden',
  },
  define: {
    // 注入到前端代码，main.tsx 会挂到 window.__REMOS_VERSION__
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths(),
    versionJsonPlugin(),
  ],
  server: {
    // 第三方接口均不支持浏览器直连，统一通过 Vite 代理转发为同源请求
    proxy: {
      '/api/anysearch': {
        target: 'https://api.anysearch.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anysearch/, ''),
      },
      // 智谱 GLM（CORS 预检失效，必须走同源代理；支持 SSE 流式透传）
      '/api/glm': {
        target: 'https://open.bigmodel.cn/api/paas/v4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/glm/, ''),
      },
      // 锐机热搜库（RejHotSearchDB）同源加速节点。
      // 注意：Vite 代理按 startsWith(context) 匹配，各路径不能互为前缀，
      // 因此统一使用 /api/hotsearch-<name> 命名，由前端自动测速后选择最快节点。
      // GitHub Raw 直连
      '/api/hotsearch-raw': {
        target: 'https://raw.githubusercontent.com/RejTech/RejHotSearchDB/main/archives',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hotsearch-raw/, ''),
      },
      // gh-proxy.com 公益加速（https://gh-proxy.com/<完整 raw URL>）
      '/api/hotsearch-ghproxy': {
        target: 'https://gh-proxy.com/https://raw.githubusercontent.com/RejTech/RejHotSearchDB/main/archives',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hotsearch-ghproxy/, ''),
      },
      // jsDelivr Gcore 边缘
      '/api/hotsearch-gcore': {
        target: 'https://gcore.jsdelivr.net/gh/RejTech/RejHotSearchDB@main/archives',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hotsearch-gcore/, ''),
      },
      // GitHub Actions 运行状态（api.github.com）
      '/api/gh-actions': {
        target: 'https://api.github.com/repos/RejTech/RejHotSearchDB/actions',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gh-actions/, ''),
      },
    },
  },
})
