import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 检测当前是否为移动设备（基于 UA，而非屏幕宽度——桌面窄窗口不分流）。
 * iPadOS 13+ 的 Safari 默认伪装成 Mac 桌面 UA，用「Mac UA + 多点触控」特判。
 */
export function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return true;
  }
  return /Mac/i.test(ua) && navigator.maxTouchPoints > 1;
}
