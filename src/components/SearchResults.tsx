import { useState } from 'react';
import { useSearchStore } from '../store/searchStore';

export function SearchResults() {
  const {
    results,
    total,
    isLoading,
    error,
    selectedResult,
    selectResult,
  } = useSearchStore();

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleResultClick = (result: typeof results[0], index: number) => {
    setActiveIndex(index);
    selectResult(result);
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

  return (
    <div className="mt-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-500 text-sm">
            找到 <span className="text-gray-800 font-semibold">{total}</span> 条结果
          </p>
        </div>

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

              {selectedResult ? (
                <>
                  <h4 className="text-sm font-medium text-gray-700 mb-2 line-clamp-2">
                    {selectedResult.title}
                  </h4>
                  <p className="text-xs text-gray-400 mb-4 font-mono truncate">
                    {selectedResult.url}
                  </p>
                  
                  <div className="max-h-[500px] overflow-y-auto">
                    {selectedResult.content ? (
                      <div className="whitespace-pre-wrap text-gray-600 text-sm leading-relaxed break-all">
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
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-sm">点击搜索结果查看详情</p>
                </div>
              )}
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

            <div className="p-4 border-b border-gray-50 shrink-0">
              <h4 className="text-base font-medium text-gray-800 mb-2 line-clamp-2">
                {selectedResult.title}
              </h4>
              <p className="text-xs text-gray-400 font-mono truncate">
                {selectedResult.url}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {selectedResult.content ? (
                <div className="whitespace-pre-wrap text-gray-600 text-sm leading-relaxed break-all">
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
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
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