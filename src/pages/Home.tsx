import { useState } from 'react';
import { SearchBar } from '../components/SearchBar';
import { SearchResults } from '../components/SearchResults';
import { LicenseButton } from '../components/LicenseButton';
import { type EmbedConfig, DEFAULT_EMBED_CONFIG, buildEmbedUrl } from '../lib/embedConfig';
import pkg from '../../package.json';

const TOGGLE_OPTIONS: { key: keyof EmbedConfig; label: string; desc: string }[] = [
  { key: 'showTitle', label: '标题和副标题', desc: '显示"锐机超级搜索"标题' },
  { key: 'showGLM', label: 'GLM-4 摘要', desc: '显示 AI 总体概括和详情摘要' },
  { key: 'showLicense', label: '许可证信息', desc: '显示本项目许可证按钮' },
  { key: 'showVersion', label: '版本号', desc: '显示底部版本号' },
  { key: 'allowInlineSearch', label: '内嵌搜索', desc: '允许在内嵌页面内搜索（关闭则跳转主页）' },
];

export default function Home() {
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
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <SearchBar />
          <SearchResults />
        </div>
      </div>

      <footer className="border-t border-gray-100 bg-white py-4 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">版本 {pkg.version}</span>
            <span className="hidden sm:inline text-gray-300">|</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCustomizeModal(true)}
              className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-blue-600 text-sm hover:bg-blue-100 transition-colors"
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

          <div className="relative bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-medium text-gray-800">定制内嵌部件</h3>
              <button
                onClick={() => setShowCustomizeModal(false)}
                className="text-gray-400 text-sm hover:text-gray-600 transition-colors"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {TOGGLE_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800 font-medium">{opt.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleOption(opt.key)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 ${
                      embedConfig[opt.key] ? 'bg-blue-500' : 'bg-gray-300'
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

            <div className="p-4 border-t border-gray-100 shrink-0 space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">内嵌链接</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={embedUrl}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-600 font-mono outline-none min-w-0"
                  />
                  <button
                    onClick={copyUrl}
                    className="px-4 py-2 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-700 transition-colors shrink-0"
                  >
                    {copied ? '已复制' : '复制链接'}
                  </button>
                </div>
              </div>
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2 bg-blue-50 border border-blue-200 text-blue-600 text-sm rounded-lg hover:bg-blue-100 transition-colors"
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
