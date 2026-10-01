import { useState } from 'react';
import { SearchBar } from '../components/SearchBar';
import { SearchResults } from '../components/SearchResults';
import { ChatMode } from '../components/ChatMode';
import { HotSearchExpert } from '../components/HotSearchExpert';
import { LicenseButton } from '../components/LicenseButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { type EmbedConfig, DEFAULT_EMBED_CONFIG, buildEmbedUrl } from '../lib/embedConfig';
import pkg from '../../package.json';

const TOGGLE_OPTIONS: { key: keyof EmbedConfig; label: string; desc: string }[] = [
  { key: 'showTitle', label: '标题和副标题', desc: '显示「锐机超级搜索」标题与副标题' },
  { key: 'allowInlineSearch', label: '内嵌搜索', desc: '允许在内嵌页面内搜索（关闭则点击搜索跳转主页）' },
  { key: 'showGLM', label: 'GLM-4 摘要', desc: 'AI 总体概括（含引用徽章）与单条结果详情摘要' },
  { key: 'showHotSearch', label: '锐机热搜专家', desc: '按日期/时间点选择各平台热搜，点击词条直接进入检索工作流' },
  { key: 'showLicense', label: '许可证信息', desc: '底部显示「本项目许可证」按钮（GLM 解析 GPLv3）' },
  { key: 'showVersion', label: '版本号', desc: '底部显示当前版本号' },
];

type AppMode = 'search' | 'chat' | 'hot';

const MODE_ORDER: AppMode[] = ['search', 'chat', 'hot'];

export default function Home() {
  const [mode, setMode] = useState<AppMode>('search');
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [embedConfig, setEmbedConfig] = useState<EmbedConfig>(DEFAULT_EMBED_CONFIG);
  const [copied, setCopied] = useState(false);

  const embedUrl = buildEmbedUrl(window.location.origin, embedConfig);

  const toggleOption = (key: keyof EmbedConfig) => {
    setEmbedConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(embedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 transition-colors">
      {/* 顶部标题（不随模式切换变化） */}
      <div className="text-center pt-8 pb-2 px-4">
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
          锐机超级搜索v6
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">智能检索，发现世界</p>
      </div>

      {/* 模式切换滑块 */}
      <div className="pt-2 pb-2 px-4 flex justify-center">
        <div className="w-full max-w-md bg-gray-100 dark:bg-gray-800 rounded-full p-1 relative flex">
          <div
            className="absolute top-1 bottom-1 left-1 bg-white dark:bg-gray-700 rounded-full shadow-sm transition-transform duration-300"
            style={{
              width: 'calc((100% - 8px) / 3)',
              transform: `translateX(${MODE_ORDER.indexOf(mode) * 100}%)`,
            }}
          />
          <button
            onClick={() => setMode('search')}
            className={`relative z-10 flex-1 min-w-0 text-center px-2 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
              mode === 'search'
                ? 'text-gray-800 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            搜索主导
          </button>
          <button
            onClick={() => setMode('chat')}
            className={`relative z-10 flex-1 min-w-0 text-center px-2 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap flex items-center justify-center gap-1 transition-colors ${
              mode === 'chat'
                ? 'text-gray-800 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="whitespace-nowrap">AI 自搜</span>
          </button>
          <button
            onClick={() => setMode('hot')}
            className={`relative z-10 flex-1 min-w-0 text-center px-2 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap flex items-center justify-center gap-1 transition-colors ${
              mode === 'hot'
                ? 'text-gray-800 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="whitespace-nowrap">热搜专家</span>
            <span className="shrink-0 px-1 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 leading-none whitespace-nowrap">
              NEW
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 py-4 px-4">
        <div className="max-w-6xl mx-auto">
          {mode === 'search' ? (
            <>
              <SearchBar showTitle={false} />
              <SearchResults />
            </>
          ) : mode === 'chat' ? (
            <ChatMode />
          ) : (
            <HotSearchExpert />
          )}
        </div>
      </div>

      <footer className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-4 px-4 transition-colors">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 dark:text-gray-400 text-sm">版本 {pkg.version}</span>
            <span className="hidden sm:inline text-gray-300 dark:text-gray-700">|</span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => setShowCustomizeModal(true)}
              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded text-blue-600 dark:text-blue-300 text-sm hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
            >
              定制内嵌部件
            </button>
            <LicenseButton />
          </div>
        </div>
      </footer>

      {/* 定制内嵌部件弹窗 */}
      {showCustomizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCustomizeModal(false)}
          />

          <div className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-lg transition-colors">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <h3 className="text-base font-medium text-gray-800 dark:text-gray-100">定制内嵌部件</h3>
              <button
                onClick={() => setShowCustomizeModal(false)}
                className="text-gray-400 dark:text-gray-500 text-sm hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {TOGGLE_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800 dark:text-gray-100 font-medium">{opt.label}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">{opt.desc}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleOption(opt.key)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 ${
                      embedConfig[opt.key] ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        embedConfig[opt.key] ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700 shrink-0 space-y-3">
              <div>
                <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">内嵌链接</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={embedUrl}
                    className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-mono outline-none min-w-0"
                  />
                  <button
                    onClick={copyUrl}
                    className="px-4 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-sm rounded-full hover:bg-gray-700 dark:hover:bg-white transition-colors shrink-0"
                  >
                    {copied ? '已复制' : '复制链接'}
                  </button>
                </div>
              </div>
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 text-sm rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
              >
                在新标签页预览
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
