import { useState, useEffect } from 'react';
import { useSearchStore } from '../store/searchStore';
import { search } from '../lib/anysearch';
import { summarizeOverview, generateSearchDirection } from '../lib/glm';

interface SearchBarProps {
  showTitle?: boolean;
  redirectOnSearch?: boolean;
  showAdvancedSearch?: boolean;
  showGLM?: boolean;
}

export function SearchBar({
  showTitle = true,
  redirectOnSearch = false,
  showAdvancedSearch = true,
  showGLM = true,
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
    searchDirection,
    setSearchDirection,
    isDirectionLoading,
    setDirectionLoading,
  } = useSearchStore();

  const [isFocused, setIsFocused] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [directionInput, setDirectionInput] = useState('');
  // 可编辑的 tag / params（识别后回填，允许手动修改）
  const [tagInput, setTagInput] = useState('');
  const [paramsInput, setParamsInput] = useState('');

  const handleGenerateDirection = async () => {
    const desc = directionInput.trim();
    if (!desc) return;

    setDirectionLoading(true);
    try {
      const direction = await generateSearchDirection(desc);
      setSearchDirection(direction);
      setTagInput(direction.tag);
      setParamsInput(
        Object.keys(direction.params).length > 0
          ? JSON.stringify(direction.params, null, 0)
          : '',
      );
    } catch {
      setSearchDirection({
        tag: '',
        params: {},
        domain: '',
        reason: '识别失败，使用通用搜索',
      });
    } finally {
      setDirectionLoading(false);
    }
  };

  // 解析手动编辑的 params JSON
  const parseParams = (raw: string): Record<string, unknown> | undefined => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
    } catch {
      return undefined;
    }
  };

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
      const params = parseParams(paramsInput);
      const response = await search({
        query: q,
        maxResults: 10,
        tag: tagInput.trim() || undefined,
        params,
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

  // 主页模式下读取 ?q= 参数自动搜索（从内嵌页面跳转而来）
  useEffect(() => {
    if (redirectOnSearch) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      setQuery(q);
      handleSearch(q);
      // 清除 URL 中的 q 参数，避免刷新时重复搜索
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
  };

  const clearDirection = () => {
    setSearchDirection(null);
    setTagInput('');
    setParamsInput('');
    setDirectionInput('');
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      {showTitle && (
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-800 mb-2">
            锐机超级搜索v4
          </h1>
          <p className="text-gray-500 text-sm">智能检索，发现世界</p>
        </div>
      )}

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

      {/* 高级搜索方向（Tags & Params） */}
      {showAdvancedSearch && (
      <div className="mt-3">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-gray-500 text-sm hover:text-gray-700 transition-colors"
        >
          <span>{showAdvanced ? '▾' : '▸'}</span>
          <span>高级搜索</span>
          {searchDirection && searchDirection.tag && (
            <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
              {searchDirection.domain || searchDirection.tag}
            </span>
          )}
        </button>

        {showAdvanced && (
          <div className="mt-3 p-4 bg-gray-50 border border-gray-100 rounded-lg space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-gray-600 text-sm">搜索方向（自然语言描述）</label>
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">AI</span>
              </div>
              <div className="flex gap-2">
                <textarea
                  value={directionInput}
                  onChange={(e) => setDirectionInput(e.target.value)}
                  placeholder="例如：查找 Go 语言的并发编程文档 / 查询苹果公司最新股价 / 搜索某公司的工商注册信息"
                  rows={2}
                  className="flex-1 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 resize-none min-w-0"
                />
                <button
                  onClick={handleGenerateDirection}
                  disabled={!directionInput.trim() || isDirectionLoading}
                  className={`px-3 py-2 rounded-md text-sm font-medium shrink-0 transition-colors ${
                    directionInput.trim() && !isDirectionLoading
                      ? 'bg-gray-800 text-white hover:bg-gray-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isDirectionLoading ? '识别中...' : 'GLM 智能识别'}
                </button>
              </div>
            </div>

            {/* 识别结果展示 */}
            {searchDirection && (
              <div className="p-3 bg-white border border-blue-100 rounded-md">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-600 font-medium">识别结果</span>
                    {searchDirection.domain && (
                      <span className="text-xs text-gray-500">{searchDirection.domain}</span>
                    )}
                  </div>
                  <button
                    onClick={clearDirection}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    清除方向
                  </button>
                </div>
                {searchDirection.reason && (
                  <p className="text-xs text-gray-500 mb-2">{searchDirection.reason}</p>
                )}
              </div>
            )}

            {/* 可编辑的 Tag / Params */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-600 text-xs mb-1">Tag</label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="如 code.doc（留空为通用搜索）"
                  className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="block text-gray-600 text-xs mb-1">Params（JSON）</label>
                <input
                  type="text"
                  value={paramsInput}
                  onChange={(e) => setParamsInput(e.target.value)}
                  placeholder='如 {"library":"golang"}'
                  className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 font-mono"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              GLM 识别后可手动修改 Tag 与 Params，留空 Tag 则使用通用搜索。
            </p>
          </div>
        )}
      </div>
      )}

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
