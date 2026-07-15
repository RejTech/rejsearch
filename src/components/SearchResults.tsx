import { useState } from 'react';
import { ExternalLink, Clock, Globe, ChevronRight, Loader2, X } from 'lucide-react';
import { useSearchStore } from '../store/searchStore';
import { extract } from '../lib/anysearch';

export function SearchResults() {
  const {
    results,
    total,
    isLoading,
    error,
    selectedResult,
    selectResult,
    extractedContent,
    setExtractedContent,
    isExtracting,
    setExtracting,
  } = useSearchStore();

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleResultClick = async (result: typeof results[0], index: number) => {
    setActiveIndex(index);
    selectResult(result);
    setExtracting(true);

    try {
      const response = await extract(result.url);
      setExtractedContent(response.content);
    } catch (err) {
      setExtractedContent(`无法提取内容: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setExtracting(false);
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

  if (isLoading) {
    return (
      <div className="mt-8 max-w-4xl mx-auto">
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="h-5 bg-white/20 rounded w-3/4 mb-3" />
              <div className="h-4 bg-white/15 rounded w-full mb-3" />
              <div className="h-4 bg-white/15 rounded w-5/6 mb-4" />
              <div className="flex items-center gap-4">
                <div className="h-3 bg-white/10 rounded w-20" />
                <div className="h-3 bg-white/10 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <p className="text-gray-300">
          找到 <span className="text-accent-400 font-bold">{total}</span> 条结果
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {results.map((result, index) => (
            <div
              key={index}
              onClick={() => handleResultClick(result, index)}
              className={`bg-white/5 backdrop-blur-xl border rounded-xl p-6 cursor-pointer transition-all duration-300 group ${
                activeIndex === index
                  ? 'border-accent-500 shadow-lg shadow-accent-500/10'
                  : 'border-white/10 hover:border-accent-500/50 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-accent-300 transition-colors">
                    {result.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-3">
                    {result.snippet}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {result.source && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {result.source}
                      </span>
                    )}
                    {result.timestamp && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(result.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-500 hover:text-accent-400 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-accent-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-xs text-gray-500 font-mono truncate">
                  {result.url}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">内容详情</h3>
              {selectedResult && (
                <button
                  onClick={() => {
                    selectResult(null);
                    setActiveIndex(null);
                    setExtractedContent('');
                  }}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {selectedResult ? (
              <>
                <h4 className="text-sm font-medium text-accent-300 mb-2 line-clamp-2">
                  {selectedResult.title}
                </h4>
                <p className="text-xs text-gray-500 mb-4 font-mono truncate">
                  {selectedResult.url}
                </p>
                
                {isExtracting ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-accent-400 animate-spin" />
                  </div>
                ) : (
                  <div className="max-h-[600px] overflow-y-auto">
                    <div className="prose prose-invert prose-sm max-w-none">
                      {extractedContent ? (
                        <div className="whitespace-pre-wrap text-gray-300 text-sm leading-relaxed">
                          {extractedContent}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-8">
                          点击搜索结果查看内容
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                  <ExternalLink className="w-8 h-8 text-gray-600" />
                </div>
                <p className="text-gray-500">点击搜索结果查看详情</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}