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
    // AnySearch API 不支持浏览器 CORS，通过 Vite 代理转发为同源请求
    proxy: {
      '/api/anysearch': {
        target: 'https://api.anysearch.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anysearch/, ''),
      },
    },
  },
})
