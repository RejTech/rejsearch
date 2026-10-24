import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

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
