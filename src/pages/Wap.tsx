import { useEffect, useState, type CSSProperties } from 'react';
import { SearchBar } from '../components/SearchBar';
import { SearchResults } from '../components/SearchResults';
import { ChatMode } from '../components/ChatMode';
import { HotSearchExpert } from '../components/HotSearchExpert';
import { playLift } from '../lib/sound';
import { isEmbedApp, getEmbedAppUaVersion } from '../lib/utils';

// 由 vite.config.ts define 注入（package.json 的 apkVersion）
declare const __APK_VERSION__: string;

// 根据 apkVersion 自动定位安装包：匹配 RemoSearchApp_v<apkVersion>_release.apk，
// 未匹配时兜底取目录下唯一/首个 APK；发新版只需替换文件 + 改 package.json，无需动代码
const apkModules = import.meta.glob('../assets/apks/*.apk', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const apkUrls = Object.entries(apkModules);
const latestApkUrl: string | undefined =
  apkUrls.find(([path]) => path.includes(`_v${__APK_VERSION__}_`))?.[1] ?? apkUrls[0]?.[1];

type WapMode = 'search' | 'chat' | 'hot';

const MODES: { key: WapMode; label: string }[] = [
  { key: 'search', label: '搜索' },
  { key: 'chat', label: 'AI 自搜' },
  { key: 'hot', label: '热搜' },
];

/** 解析 #search / #chat / #hot（兼容 #/hot 写法），非法值返回 null */
function parseHashMode(): WapMode | null {
  const raw = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  return MODES.find((m) => m.key === raw)?.key ?? null;
}

/**
 * 移动端专属界面（/wap）。
 * 不复用桌面自适应布局：仅底部悬浮 LiquidGlass 标签栏（三模式），
 * 详情详情一律走底部弹窗（SearchResults 内部 <1024px 行为）。
 *
 * 内嵌安卓 App（UA 含 RWACore）时隐藏底栏：模式由 #hash 切换，
 * 宿主改 hash 即切页，站内切换也会把当前模式写回 hash 供宿主读取。
 */
export default function Wap() {
  const [mode, setMode] = useState<WapMode>(() => parseHashMode() ?? 'search');
  // UA 不会变，首帧判断一次即可
  const [embed] = useState(isEmbedApp);
  // RWACore UA 版本与最新 apkVersion 不一致（含旧版宿主未携带版本号）→ 弹更新弹窗
  const [uaVersion] = useState(getEmbedAppUaVersion);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const showUpdateDialog = embed && !updateDismissed && uaVersion !== __APK_VERSION__ && !!latestApkUrl;

  // 切换模式：播放 lift 音效（点击当前已选模式不响）
  const switchMode = (next: WapMode) => {
    if (next === mode) return;
    playLift();
    setMode(next);
  };

  // 宿主改 hash → 切页（hashchange 不触发 React Router，需手动同步）
  useEffect(() => {
    const onHashChange = () => {
      const next = parseHashMode();
      if (next) setMode((prev) => (prev === next ? prev : next));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // 站内切模式 → 写回 hash（replaceState 不产生历史记录，也不触发 hashchange）
  useEffect(() => {
    const target = `#${mode}`;
    if (window.location.hash !== target) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}${target}`,
      );
    }
  }, [mode]);

  return (
    <div
      className="relative min-h-[100dvh] overflow-x-hidden bg-white transition-colors dark:bg-gray-900"
      // 内嵌隐藏底栏时把底栏占位归零，ChatMode/追问栏等置底组件自动贴底
      // 内嵌宿主已处理系统安全区：安全区变量一并归零，内容自动置顶/贴底
      style={
        {
          '--wap-nav-h': embed ? '0rem' : '4.5rem',
          '--wap-safe-top': embed ? '0px' : 'env(safe-area-inset-top)',
          '--wap-safe-bottom': embed ? '0px' : 'env(safe-area-inset-bottom)',
        } as CSSProperties
      }
    >
      {/* 内容区（三个模式复用原有组件，详情均为移动端弹窗形态） */}
      <main
        className={`relative px-3 pt-4 ${
          embed ? 'pb-[calc(1rem+var(--wap-safe-bottom,env(safe-area-inset-bottom)))]' : 'pb-36'
        }`}
      >
        {mode === 'search' && (
          <>
            <SearchBar showTitle={false} />
            {/* 下载通知：仅非内嵌（非 RWACore）访问时展示，内嵌宿主已有原生入口 */}
            {!embed && latestApkUrl && (
              <div className="mx-auto mt-4 w-full max-w-3xl px-4 sm:px-6">
                <a
                  href={latestApkUrl}
                  download={`RemoSearchApp_v${__APK_VERSION__}.apk`}
                  className="liquid-glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-white/70 dark:hover:bg-gray-700/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      推荐下载 RemoSearch App
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      移动端体验更佳，点击前往下载
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-800 px-4 py-1.5 text-xs font-medium text-white dark:bg-gray-100 dark:text-gray-900">
                    点击下载
                  </span>
                </a>
              </div>
            )}
            <SearchResults variant="wap" />
          </>
        )}
        {mode === 'chat' && <ChatMode variant="wap" />}
        {mode === 'hot' && <HotSearchExpert variant="wap" />}
      </main>

      {/* 底部悬浮 LiquidGlass 标签栏（内嵌 App 由宿主 UI 接管，不渲染） */}
      {!embed && (
        <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,var(--wap-safe-bottom,env(safe-area-inset-bottom)))]">
          <div className="liquid-glass relative mx-auto flex max-w-md rounded-full p-1">
            {/* 滑动高亮药丸 */}
            <div
              className="absolute bottom-1 left-1 top-1 rounded-full bg-white/90 shadow-[0_2px_12px_rgba(17,24,39,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] transition-transform duration-300 ease-out dark:bg-gray-600/80 dark:shadow-[0_2px_12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{
                width: 'calc((100% - 8px) / 3)',
                transform: `translateX(${MODES.findIndex((m) => m.key === mode) * 100}%)`,
              }}
            />
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => switchMode(m.key)}
                className={`relative z-10 flex-1 rounded-full py-2.5 text-center text-sm font-medium transition-colors ${
                  mode === m.key
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* RWACore 版本过旧更新弹窗：UA 版本 ≠ apkVersion 时显示 */}
      {showUpdateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6 backdrop-blur-sm">
          <div className="liquid-glass w-full max-w-sm rounded-2xl p-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              发现新版本
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              RemoSearch App 已更新至
              <span className="mx-1 font-medium text-blue-600 dark:text-blue-400">{__APK_VERSION__}</span>
              {uaVersion ? (
                <>
                  ，当前版本
                  <span className="mx-1 font-medium text-gray-800 dark:text-gray-200">{uaVersion}</span>
                </>
              ) : null}
              。建议更新以获得最新功能与修复。
            </p>
            <div className="mt-4 flex gap-2.5">
              <button
                onClick={() => setUpdateDismissed(true)}
                className="flex-1 rounded-full border border-gray-300/70 bg-white/50 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-white/80 dark:border-gray-600 dark:bg-gray-700/40 dark:text-gray-300 dark:hover:bg-gray-700/70"
              >
                暂不更新
              </button>
              <a
                href={latestApkUrl}
                download={`RemoSearchApp_v${__APK_VERSION__}.apk`}
                className="flex-1 rounded-full bg-gray-800 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
              >
                立即更新
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
