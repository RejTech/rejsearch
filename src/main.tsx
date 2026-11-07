import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { isEmbedApp } from './lib/utils'

// 毛玻璃等视觉效果仅对内嵌宿主（RWACore）启用；直接访问走不透明样式
if (isEmbedApp()) document.documentElement.classList.add('embed-app')

// 暴露版本号给 RWACore 等外部容器（WebView 内可直接读取 window.__REMOS_VERSION__ / __REMOS_APK_VERSION__）
declare const __APP_VERSION__: string
declare const __APK_VERSION__: string
;(window as unknown as { __REMOS_VERSION__: string; __REMOS_APK_VERSION__: string }).__REMOS_VERSION__ = __APP_VERSION__
;(window as unknown as { __REMOS_APK_VERSION__: string }).__REMOS_APK_VERSION__ = __APK_VERSION__

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
