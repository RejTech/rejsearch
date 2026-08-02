import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { SearchBar } from '../components/SearchBar';
import { SearchResults } from '../components/SearchResults';
import { summarizeLicense } from '../lib/glm';
import pkg from '../../package.json';

/**
 * 逐字浮入渲染许可证摘要，【允许做】绿色、【不允许做】红色。
 * key 为绝对位置，流式追加时已有字符不重复动画。
 */
function renderAnimatedLicense(text: string) {
  const regex = /【允许做】|【不允许做】/g;
  const elements: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    for (let i = lastIndex; i < match.index; i++) {
      elements.push(<span key={`c${i}`} className="animate-fade-in-up">{text[i]}</span>);
    }
    const isAllow = match[0] === '【允许做】';
    const colorClass = isAllow
      ? 'text-green-600 font-medium text-base'
      : 'text-red-600 font-medium text-base';
    for (let i = 0; i < match[0].length; i++) {
      const pos = match.index + i;
      elements.push(<span key={`c${pos}`} className={`animate-fade-in-up ${colorClass}`}>{match[0][i]}</span>);
    }
    lastIndex = match.index + match[0].length;
  }
  for (let i = lastIndex; i < text.length; i++) {
    elements.push(<span key={`c${i}`} className="animate-fade-in-up">{text[i]}</span>);
  }
  return elements;
}

export default function Home() {
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseSummary, setLicenseSummary] = useState('');
  const [isLicenseLoading, setIsLicenseLoading] = useState(false);
  const [licenseContent, setLicenseContent] = useState('');
  const [showOriginalLicense, setShowOriginalLicense] = useState(false);

  const licenseElements = useMemo(
    () => renderAnimatedLicense(licenseSummary),
    [licenseSummary],
  );

  useEffect(() => {
    fetch('/LICENSE')
      .then((res) => res.text())
      .then((text) => setLicenseContent(text))
      .catch(() => {});
  }, []);

  const handleLicenseClick = async () => {
    if (!licenseContent) return;

    setShowLicenseModal(true);
    setShowOriginalLicense(false);

    if (!licenseSummary) {
      setLicenseSummary('');
      setIsLicenseLoading(true);
      try {
        await summarizeLicense(licenseContent, (chunk) => {
          setLicenseSummary((prev) => prev + chunk);
        });
      } catch {
        setLicenseSummary('AI 许可证解析失败，请稍后重试');
      } finally {
        setIsLicenseLoading(false);
      }
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
              onClick={handleLicenseClick}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-600 text-sm hover:bg-gray-100 transition-colors"
            >
              本项目许可证（GPLv3）
            </button>
          </div>
        </div>
      </footer>

      {showLicenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowLicenseModal(false);
              setShowOriginalLicense(false);
            }}
          />

          <div className="relative bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-gray-800">本项目许可证</h3>
              </div>
              <button
                onClick={() => {
                  setShowLicenseModal(false);
                  setShowOriginalLicense(false);
                }}
                className="text-gray-400 text-sm hover:text-gray-600 transition-colors"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {showOriginalLicense ? (
                <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {licenseContent}
                </pre>
              ) : isLicenseLoading || licenseSummary ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">AI 解析</span>
                    <span className="text-xs text-gray-400">基于 GLM-4-Flash 生成</span>
                  </div>
                  <div className="text-sm text-gray-600 leading-relaxed">
                    {licenseElements}
                    {isLicenseLoading && <span className="animate-blink text-gray-400">▋</span>}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setShowOriginalLicense(!showOriginalLicense)}
                className="w-full py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
              >
                {showOriginalLicense ? '查看 AI 解析' : '查看原文'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}