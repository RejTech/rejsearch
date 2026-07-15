import { useState, useEffect } from 'react';
import { SearchBar } from '../components/SearchBar';
import { SearchResults } from '../components/SearchResults';
import { summarizeLicense } from '../lib/glm';
import pkg from '../../package.json';

export default function Home() {
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseSummary, setLicenseSummary] = useState('');
  const [isLicenseLoading, setIsLicenseLoading] = useState(false);
  const [licenseContent, setLicenseContent] = useState('');
  const [showOriginalLicense, setShowOriginalLicense] = useState(false);

  useEffect(() => {
    fetch('/LICENSE')
      .then((res) => res.text())
      .then((text) => setLicenseContent(text))
      .catch(() => {});
  }, []);

  const handleLicenseClick = async () => {
    if (!licenseContent) return;
    
    setShowLicenseModal(true);
    setLicenseSummary('');
    setShowOriginalLicense(false);

    if (!licenseSummary) {
      setIsLicenseLoading(true);
      try {
        const summary = await summarizeLicense(licenseContent);
        setLicenseSummary(summary);
      } catch {
        setLicenseSummary('AI 许可证解析失败，请稍后重试');
      } finally {
        setIsLicenseLoading(false);
      }
    }
  };

  const formatLicenseSummary = (text: string): string => {
    return text
      .replace(/【允许做】/g, '<strong class="text-green-600 text-base">【允许做】</strong>')
      .replace(/【不允许做】/g, '<strong class="text-red-600 text-base">【不允许做】</strong>')
      .replace(/^- /gm, '<span class="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2 align-middle"></span>');
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
                <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">AI</span>
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
              ) : isLicenseLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-400">GLM-4-Flash 正在解析许可证...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">AI 解析</span>
                    <span className="text-xs text-gray-400">基于 GLM-4-Flash 生成</span>
                  </div>
                  <div
                    className="text-sm text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatLicenseSummary(licenseSummary) }}
                  />
                </div>
              )}
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