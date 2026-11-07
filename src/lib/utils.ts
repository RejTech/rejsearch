import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 内嵌宿主 App（安卓 WebView）UA 标识：命中时 WAP 隐藏底栏，改由 #hash 切换模式 */
const EMBED_APP_UA = /RWACore/i;

/** 当前是否运行在内嵌宿主 App 中 */
export function isEmbedApp(): boolean {
  return EMBED_APP_UA.test(navigator.userAgent);
}

/**
 * 解析宿主 App UA 中 RWACore 标识后跟随的版本号（如「RWACore/2026.10.25.0724」）。
 * 命中 RWACore 但未携带版本号时返回 null（视为旧版宿主）。
 */
export function getEmbedAppUaVersion(): string | null {
  const m = navigator.userAgent.match(/RWACore[\/\s]?([0-9][\w.-]*)?/i);
  if (!m) return null;
  return m[1] ?? null;
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
