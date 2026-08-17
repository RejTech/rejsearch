import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { summarizeLicense } from '../lib/glm';

/** 逐字浮入渲染许可证摘要，【允许做】绿色、【不允许做】红色。 */
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

export function LicenseButton() {
  const [showModal, setShowModal] = useState(false);
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);

  const elements = useMemo(() => renderAnimatedLicense(summary), [summary]);

  useEffect(() => {
    fetch('/LICENSE')
      .then((res) => res.text())
      .then((text) => setContent(text))
      .catch(() => {});
  }, []);

  const handleClick = async () => {
    if (!content) return;
    setShowModal(true);
    setShowOriginal(false);

    if (!summary) {
      setSummary('');
      setIsLoading(true);
      try {
        await summarizeLicense(content, (chunk) => {
          setSummary((prev) => prev + chunk);
        });
      } catch {
        setSummary('AI 许可证解析失败，请稍后重试');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const close = () => {
    setShowModal(false);
    setShowOriginal(false);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        本项目许可证（GPLv3）
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />

          <div className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-lg transition-colors">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <h3 className="text-base font-medium text-gray-800 dark:text-gray-100">本项目许可证</h3>
              <button onClick={close} className="text-gray-400 dark:text-gray-500 text-sm hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                关闭
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {showOriginal ? (
                <pre className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {content}
                </pre>
              ) : isLoading || summary ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-xs rounded-full">AI 解析</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">基于 GLM-4-Flash 生成</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {elements}
                    {isLoading && <span className="animate-blink text-gray-400 dark:text-gray-500">▋</span>}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className="w-full py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-sm rounded-full hover:bg-gray-700 dark:hover:bg-white transition-colors"
              >
                {showOriginal ? '查看 AI 解析' : '查看原文'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
