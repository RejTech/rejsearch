import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths()
  ],
  server: {
    // 第三方接口均不支持浏览器直连，统一通过 Vite 代理转发为同源请求
    proxy: {
      '/api/anysearch': {
        target: 'https://api.anysearch.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anysearch/, ''),
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
