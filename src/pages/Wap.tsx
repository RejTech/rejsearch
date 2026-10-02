import { useState } from 'react';
import { SearchBar } from '../components/SearchBar';
import { SearchResults } from '../components/SearchResults';
import { ChatMode } from '../components/ChatMode';
import { HotSearchExpert } from '../components/HotSearchExpert';
import { playLift } from '../lib/sound';

type WapMode = 'search' | 'chat' | 'hot';

const MODES: { key: WapMode; label: string }[] = [
  { key: 'search', label: '搜索' },
  { key: 'chat', label: 'AI 自搜' },
  { key: 'hot', label: '热搜' },
];

/**
 * 移动端专属界面（/wap）。
 * 不复用桌面自适应布局：仅底部悬浮 LiquidGlass 标签栏（三模式），
 * 详情详情一律走底部弹窗（SearchResults 内部 <1024px 行为）。
 */
export default function Wap() {
  const [mode, setMode] = useState<WapMode>('search');

  // 切换模式：播放 lift 音效（点击当前已选模式不响）
  const switchMode = (next: WapMode) => {
    if (next === mode) return;
    playLift();
    setMode(next);
  };

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-white transition-colors dark:bg-gray-900">
      {/* 内容区（三个模式复用原有组件，详情均为移动端弹窗形态） */}
      <main className="relative px-3 pt-4 pb-36">
        {mode === 'search' && (
          <>
            <SearchBar showTitle={false} />
            <SearchResults variant="wap" />
          </>
        )}
        {mode === 'chat' && <ChatMode variant="wap" />}
        {mode === 'hot' && <HotSearchExpert variant="wap" />}
      </main>

      {/* 底部悬浮 LiquidGlass 标签栏 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
    </div>
  );
}
