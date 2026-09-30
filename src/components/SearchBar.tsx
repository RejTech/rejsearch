import { useState, useEffect } from 'react';
import { useSearchStore } from '../store/searchStore';
import { search } from '../lib/anysearch';
import { summarizeOverview } from '../lib/glm';

interface SearchBarProps {
  showTitle?: boolean;
  redirectOnSearch?: boolean;
  showAdvancedSearch?: boolean;
  showGLM?: boolean;
  /** 自动读取并搜索的 URL 参数名，默认 "q"（主页用），可改为 "s"（/ask 页用） */
  autoSearchParam?: string;
}

export function SearchBar({
  showTitle = true,
  redirectOnSearch = false,
  showAdvancedSearch: _showAdvancedSearch,
  showGLM = true,
  autoSearchParam = 'q',
}: SearchBarProps = {}) {
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
    appendOverviewSummary,
    setOverviewLoading,
  } = useSearchStore();

  const [isFocused, setIsFocused] = useState(false);
  const [isHistoryHovered, setIsHistoryHovered] = useState(false);

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query.trim();
    if (!q) return;

    // 内嵌模式且不允许内嵌搜索 → 跳转到主页搜索
    if (redirectOnSearch) {
      window.location.href = `${window.location.origin}/?q=${encodeURIComponent(q)}`;
      return;
    }

    setLoading(true);
    setQuery(q);
    addToHistory(q);
    setOverviewSummary('');

    try {
      const response = await search({
        query: q,
        maxResults: 20,
      });
      setResults(response.results, response.total);

      // 搜索完成后触发 GLM 总体概括（流式输出）
      if (showGLM) {
        setOverviewLoading(true);
        summarizeOverview(q, response.results, (chunk) => appendOverviewSummary(chunk))
          .catch(() => setOverviewSummary('AI 总体概括生成失败，请稍后重试'))
          .finally(() => setOverviewLoading(false));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  // 根据 autoSearchParam 读取对应 URL 参数自动搜索（默认 ?q=，/ask 页用 ?s=）
  useEffect(() => {
    if (redirectOnSearch) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get(autoSearchParam);
    if (q) {
      setQuery(q);
      handleSearch(q);
      // 清除 URL 中的参数，避免刷新时重复搜索
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleHistoryClick = (term: string) => {
    setQuery(term);
    handleSearch(term);
    // 点击词条后立即收起历史区
    setIsFocused(false);
    setIsHistoryHovered(false);
  };

  // 搜索历史显示条件：输入框有焦点 或 鼠标停在历史区域
  const showHistory = isFocused || isHistoryHovered;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      {showTitle && (
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
            锐机超级搜索v6
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">智能检索，发现世界</p>
        </div>
      )}

      <div
        className={`flex items-center border border-gray-200 dark:border-gray-700 rounded-full p-1.5 transition-all duration-300 ${
          isFocused
            ? 'border-blue-400 shadow-lg shadow-blue-100 dark:shadow-blue-900/30 ring-2 ring-blue-100 dark:ring-blue-900/40'
            : ''
        }`}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyPress={handleKeyPress}
          placeholder="输入搜索关键词..."
          className="flex-1 bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-base py-2.5 px-4 outline-none min-w-0"
        />

        {query && (
          <button
            onClick={() => setQuery('')}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
          >
            清除
          </button>
        )}

        <button
          onClick={() => handleSearch()}
          disabled={!query.trim()}
          className={`ml-1 px-5 py-2 rounded-full font-medium transition-all duration-300 shrink-0 ${
            query.trim()
              ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}
        >
          搜索
        </button>
      </div>

      {/* 搜索历史：焦点在输入框 或 鼠标在区域上时显示；鼠标移开+失焦后隐藏 */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${
          showHistory && searchHistory.length > 0
            ? 'max-h-60 opacity-100 translate-y-0 mt-6'
            : 'max-h-0 opacity-0 -translate-y-2 mt-0 pointer-events-none'
        }`}
        onMouseEnter={() => setIsHistoryHovered(true)}
        onMouseLeave={() => setIsHistoryHovered(false)}
        // 阻止 mousedown 触发 input blur，确保点击历史项能正常响应
        onMouseDown={(e) => e.preventDefault()}
      >
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 dark:text-gray-400 text-sm">搜索历史</span>
            <button
              onClick={clearHistory}
              className="text-gray-400 dark:text-gray-500 text-xs hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              清空
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((term, index) => (
              <button
                key={index}
                onClick={() => handleHistoryClick(term)}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 text-sm"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
