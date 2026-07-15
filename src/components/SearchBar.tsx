import { useState } from 'react';
import { useSearchStore } from '../store/searchStore';
import { search } from '../lib/anysearch';
import { summarizeOverview } from '../lib/glm';

export function SearchBar() {
  const {
    query,
    setQuery,
    setResults,
    setLoading,
    setError,
    addToHistory,
    searchHistory,
    clearHistory,
    setOverviewSummary,
    setOverviewLoading,
  } = useSearchStore();

  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query.trim();
    if (!q) return;

    setLoading(true);
    setQuery(q);
    addToHistory(q);
    setOverviewSummary('');

    try {
      const response = await search(q, 10);
      setResults(response.results, response.total);

      // 搜索完成后触发 GLM 总体概括
      setOverviewLoading(true);
      summarizeOverview(q, response.results)
        .then((summary) => setOverviewSummary(summary))
        .catch(() => setOverviewSummary('AI 总体概括生成失败，请稍后重试'))
        .finally(() => setOverviewLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleHistoryClick = (term: string) => {
    setQuery(term);
    handleSearch(term);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold text-gray-800 mb-2">
          锐机智能检索v3
        </h1>
        <p className="text-gray-500 text-sm">智能检索，发现世界</p>
      </div>

      <div className="flex items-center border border-gray-200 rounded-lg p-1.5 transition-all duration-300">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyPress={handleKeyPress}
          placeholder="输入搜索关键词..."
          className={`flex-1 bg-transparent text-gray-800 placeholder-gray-400 text-base py-2.5 px-4 outline-none min-w-0 ${
            isFocused ? '' : ''
          }`}
        />

        {query && (
          <button
            onClick={() => setQuery('')}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            清除
          </button>
        )}

        <button
          onClick={() => handleSearch()}
          disabled={!query.trim()}
          className={`ml-1 px-5 py-2 rounded-md font-medium transition-all duration-300 shrink-0 ${
            query.trim()
              ? 'bg-gray-800 text-white hover:bg-gray-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          搜索
        </button>
      </div>

      <div className="mt-6">
        {searchHistory.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">搜索历史</span>
              <button
                onClick={clearHistory}
                className="text-gray-400 text-xs hover:text-gray-600 transition-colors"
              >
                清空
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((term, index) => (
                <button
                  key={index}
                  onClick={() => handleHistoryClick(term)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded text-gray-600 hover:bg-gray-100 transition-all duration-200 text-sm"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
