import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 内嵌宿主 App（安卓 WebView）UA 标识：命中时 WAP 隐藏底栏，改由 #hash 切换模式 */
const EMBED_APP_UA = /RWACore/i;

/** 当前是否运行在内嵌宿主 App 中 */
export function isEmbedApp(): boolean {
  // TEMP-EMBED-TEST: 验证内嵌安全区归零，验证后必须立即改回
  return true;
}

/**
 * 检测当前是否为移动设备（基于 UA，而非屏幕宽度——桌面窄窗口不分流）。
 * iPadOS 13+ 的 Safari 默认伪装成 Mac 桌面 UA，用「Mac UA + 多点触控」特判。
 */
export function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  if (EMBED_APP_UA.test(ua)) {
    return true;
  }
  if (/Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return true;
  }
  return /Mac/i.test(ua) && navigator.maxTouchPoints > 1;
}
