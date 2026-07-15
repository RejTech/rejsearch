import { useState } from 'react';
import { useSearchStore } from '../store/searchStore';
import { summarizeContent } from '../lib/glm';
import { SearchResult } from '../lib/anysearch';

function parseOverviewSummary(text: string, results: SearchResult[]): string {
  return text.replace(/\[(\d+)\]/g, (match, numStr) => {
    const index = parseInt(numStr, 10) - 1;
    if (index >= 0 && index < results.length) {
      const result = results[index];
      return `<a href="${result.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-medium hover:bg-blue-200 hover:text-blue-700 transition-colors ml-0.5">${numStr}</a>`;
    }
    return match;
  });
}

export function SearchResults() {
  const {
    results,
    total,
    isLoading,
    error,
    selectedResult,
    selectResult,
    overviewSummary,
    isOverviewLoading,
    detailSummary,
    isDetailLoading,
    setDetailSummary,
    setDetailLoading,
  } = useSearchStore();

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleResultClick = async (result: typeof results[0], index: number) => {
    setActiveIndex(index);
    selectResult(result);
    setDetailSummary('');

    if (result.content) {
      setDetailLoading(true);
      try {
        const s = await summarizeContent(result.title, result.content);
        setDetailSummary(s);
      } catch {
        setDetailSummary('AI 摘要生成失败，请稍后重试');
      } finally {
        setDetailLoading(false);
      }
    }
  };

  const formatDate = (timestamp?: string) => {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const closeModal = () => {
    selectResult(null);
    setActiveIndex(null);
    setDetailSummary('');
    setDetailLoading(false);
  };

  if (isLoading) {
    return (
      <div className="mt-8 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-gray-50 border border-gray-100 rounded-lg p-6 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-150 rounded w-full mb-3" />
              <div className="h-4 bg-gray-150 rounded w-5/6 mb-4" />
              <div className="flex items-center gap-4">
                <div className="h-3 bg-gray-100 rounded w-20" />
                <div className="h-3 bg-gray-100 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  const renderDetail = () => {
    if (!selectedResult) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">点击搜索结果查看详情</p>
        </div>
      );
    }

    return (
      <>
        <h4 className="text-sm font-medium text-gray-700 mb-2 line-clamp-2">
          {selectedResult.title}
        </h4>
        <p className="text-xs text-gray-400 mb-4 font-mono truncate">
          {selectedResult.url}
        </p>

        {isDetailLoading && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              <span className="text-xs text-gray-500">GLM-4-Flash 正在生成摘要...</span>
            </div>
          </div>
        )}

        {detailSummary && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-600 font-medium mb-1.5">AI 摘要</p>
            <p className="text-sm text-gray-700 leading-relaxed">{detailSummary}</p>
          </div>
        )}

        <div className="max-h-[400px] overflow-y-auto">
          {selectedResult.content ? (
            <div className="whitespace-pre-wrap text-gray-500 text-xs leading-relaxed break-all">
              {selectedResult.content}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8 text-sm">
              暂无内容
            </p>
          )}
        </div>

        <a
          href={selectedResult.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block w-full text-center py-2 bg-gray-800 text-white text-sm rounded hover:bg-gray-700 transition-colors"
        >
          跳转到原页面
        </a>
      </>
    );
  };

  return (
    <div className="mt-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-500 text-sm">
            找到 <span className="text-gray-800 font-semibold">{total}</span> 条结果
          </p>
        </div>

        {/* AI 总体概括 */}
        {(isOverviewLoading || overviewSummary) && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700">AI 总体概括</span>
              {isOverviewLoading && (
                <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              )}
            </div>
            {isOverviewLoading && !overviewSummary ? (
              <p className="text-sm text-gray-400">GLM-4-Flash 正在分析所有搜索结果...</p>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: parseOverviewSummary(overviewSummary, results) }} />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {results.map((result, index) => (
              <div
                key={index}
                onClick={() => handleResultClick(result, index)}
                className={`bg-white border rounded-lg p-5 cursor-pointer transition-all duration-200 ${
                  activeIndex === index
                    ? 'border-gray-400 shadow-md'
                    : 'border-gray-100 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-gray-800 mb-2 hover:text-gray-600 transition-colors line-clamp-2">
                      {result.title}
                    </h3>
                    <p className="text-gray-500 text-sm leading-relaxed mb-3 line-clamp-2">
                      {result.snippet}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      {result.source && (
                        <span>{result.source}</span>
                      )}
                      {result.timestamp && (
                        <span>{formatDate(result.timestamp)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <p className="text-xs text-gray-400 font-mono truncate">
                    {result.url}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white border border-gray-100 rounded-lg p-4 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-medium text-gray-800">内容详情</h3>
                {selectedResult && (
                  <button
                    onClick={closeModal}
                    className="text-gray-400 text-xs hover:text-gray-600 transition-colors"
                  >
                    关闭
                  </button>
                )}
              </div>

              {renderDetail()}
            </div>
          </div>
        </div>
      </div>

      {selectedResult && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-medium text-gray-800">内容详情</h3>
              <button
                onClick={closeModal}
                className="text-gray-400 text-sm hover:text-gray-600 transition-colors"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <h4 className="text-base font-medium text-gray-800 mb-2 line-clamp-2">
                {selectedResult.title}
              </h4>
              <p className="text-xs text-gray-400 font-mono truncate mb-4">
                {selectedResult.url}
              </p>

              {isDetailLoading && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    <span className="text-xs text-gray-500">GLM-4-Flash 正在生成摘要...</span>
                  </div>
                </div>
              )}

              {detailSummary && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium mb-1.5">AI 摘要</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{detailSummary}</p>
                </div>
              )}

              {selectedResult.content ? (
                <div className="whitespace-pre-wrap text-gray-500 text-xs leading-relaxed break-all">
                  {selectedResult.content}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8 text-sm">
                  暂无内容
                </p>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 shrink-0">
              <a
                href={selectedResult.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-3 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
              >
                跳转到原页面
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .break-all {
          word-break: break-all;
        }
      `}</style>
    </div>
  );
}
