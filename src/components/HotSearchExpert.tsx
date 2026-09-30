import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchStore } from '../store/searchStore';
import { search } from '../lib/anysearch';
import { summarizeOverview } from '../lib/glm';
import { SearchResults } from './SearchResults';
import {
  PLATFORM_META,
  HOTSEARCH_NODES,
  getNodeRanking,
  formatLatency,
  fetchHotSearchIndex,
  fetchHotSearchArchive,
  getSortedDates,
  getSortedTimes,
  formatTimeLabel,
  formatHotValue,
  type HotSearchArchive,
  type HotSearchIndex,
  type HotSearchItem,
  type HotSearchPlatform,
  type NodeRankResult,
} from '../lib/hotsearch';

interface HotSearchExpertProps {
  showGLM?: boolean;
  /** 是否允许向 AI 追问（透传给原工作流的 SearchResults） */
  allowFollowUp?: boolean;
}

/** 当前选中的热搜词条（保留归档坐标，便于展示与再次提问） */
interface SelectedTopic {
  platform: HotSearchPlatform;
  platformName: string;
  item: HotSearchItem;
  date: string;
  time: string;
}

const PREVIEW_COUNT = 10;

export function HotSearchExpert({ showGLM = true, allowFollowUp = true }: HotSearchExpertProps = {}) {
  const {
    setQuery,
    setResults,
    isLoading,
    setLoading,
    setError,
    addToHistory,
    selectResult,
    setOverviewSummary,
    appendOverviewSummary,
    setOverviewLoading,
  } = useSearchStore();

  // 索引与归档状态
  const indexRef = useRef<HotSearchIndex | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [times, setTimes] = useState<string[]>([]);
  const [time, setTime] = useState('');
  const [indexLoading, setIndexLoading] = useState(true);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [archive, setArchive] = useState<HotSearchArchive | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // 加速节点测速状态
  const [rank, setRank] = useState<NodeRankResult | null>(null);
  const [speedTesting, setSpeedTesting] = useState(false);

  // 选题与提问状态
  const [topic, setTopic] = useState<SelectedTopic | null>(null);
  const [question, setQuestion] = useState('');
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());

  /** 拉取某天某个时间点的归档 */
  const loadArchive = useCallback(async (d: string, t: string) => {
    if (!d || !t) return;
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      setArchive(await fetchHotSearchArchive(d, t));
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : '热搜归档加载失败');
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  /** 拉取索引并默认选中「最新日期 + 当天最新时间点」 */
  const loadIndex = useCallback(async () => {
    setIndexLoading(true);
    setIndexError(null);
    try {
      // 首次进入自动测速（30 分钟内有缓存则直接命中，不产生额外请求）
      setSpeedTesting(true);
      let nodeRank: NodeRankResult;
      try {
        nodeRank = await getNodeRanking();
        setRank(nodeRank);
      } finally {
        setSpeedTesting(false);
      }
      const idx = await fetchHotSearchIndex();
      indexRef.current = idx;
      const sortedDates = getSortedDates(idx);
      if (sortedDates.length === 0) {
        setIndexError('暂无热搜归档数据');
        return;
      }
      const latestDate = sortedDates[0];
      const sortedTimes = getSortedTimes(idx, latestDate);
      setDates(sortedDates);
      setDate(latestDate);
      setTimes(sortedTimes);
      const latestTime = sortedTimes[sortedTimes.length - 1] ?? '';
      setTime(latestTime);
      await loadArchive(latestDate, latestTime);
    } catch (err) {
      setIndexError(err instanceof Error ? err.message : '热搜索引加载失败');
    } finally {
      setIndexLoading(false);
    }
  }, [loadArchive]);

  /** 强制重新测速，随后用新的最快节点重新拉取索引 */
  const handleSpeedTest = () => {
    if (speedTesting) return;
    setSpeedTesting(true);
    void (async () => {
      try {
        setRank(await getNodeRanking(true));
        await loadIndex();
      } finally {
        setSpeedTesting(false);
      }
    })();
  };

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  /** 日期切换：时间点重置为该日最新 */
  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const d = e.target.value;
    const sortedTimes = indexRef.current ? getSortedTimes(indexRef.current, d) : [];
    setDate(d);
    setTimes(sortedTimes);
    const t = sortedTimes[sortedTimes.length - 1] ?? '';
    setTime(t);
    void loadArchive(d, t);
  };

  /** 时间点切换 */
  const handleTimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = e.target.value;
    setTime(t);
    void loadArchive(date, t);
  };

  /**
   * 执行热搜检索：进入原有工作流（AnySearch 搜索 → 结果列表 → GLM 总体概括 → 详情/追问）。
   * 相关性保证：搜索词始终以热搜原词开头，extra 仅作为补充问题拼接在其后。
   */
  const executeSearch = async (
    item: HotSearchItem,
    platform: HotSearchPlatform,
    platformName: string,
    extra: string,
    meta: { date: string; time: string },
  ) => {
    const detail = extra.trim();
    const q = detail ? `${item.title} ${detail}` : item.title;

    setTopic({ platform, platformName, item, date: meta.date, time: meta.time });
    setLoading(true);
    setQuery(q);
    addToHistory(q);
    setOverviewSummary('');
    setError(null);
    selectResult(null);

    try {
      const response = await search({ query: q, maxResults: 20 });
      setResults(response.results, response.total);

      if (showGLM) {
        setOverviewLoading(true);
        summarizeOverview(q, response.results, (chunk) => appendOverviewSummary(chunk))
          .catch(() => setOverviewSummary('AI 总体概括生成失败，请稍后重试'))
          .finally(() => setOverviewLoading(false));
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  /** 点击榜单词条：直接以热搜原词进入原工作流 */
  const handlePickItem = (item: HotSearchItem, platform: HotSearchPlatform, platformName: string) => {
    setQuestion('');
    void executeSearch(item, platform, platformName, '', { date, time });
  };

  /** 针对当前热搜的详细提问：热搜原词 + 问题 */
  const handleAsk = () => {
    if (!topic) return;
    void executeSearch(topic.item, topic.platform, topic.platformName, question, topic);
  };

  /** 返回热搜榜，清空工作流状态 */
  const backToList = () => {
    setTopic(null);
    setQuestion('');
    setResults([], 0);
    setOverviewSummary('');
    setError(null);
    selectResult(null);
  };

  const togglePlatform = (key: string) => {
    setExpandedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 测速后最快的可用节点（latency 可能为 null=该节点不可用）
  const bestEntry = rank?.entries.find((entry) => entry.latency !== null) ?? null;
  const bestNode = bestEntry
    ? HOTSEARCH_NODES.find((node) => node.key === bestEntry.key) ?? null
    : null;
  /** 悬停节点胶囊时展示全部节点延迟 */
  const rankTooltip = rank
    ? rank.entries
        .map((entry) => {
          const node = HOTSEARCH_NODES.find((item) => item.key === entry.key);
          return `${node?.label ?? entry.key}：${formatLatency(entry.latency)}`;
        })
        .join('\n')
    : '';

  // 专家页面底部技术来源标注（榜单视图与工作流视图均展示）
  const expertFooter = (
    <p className="mt-10 mb-2 text-center text-xs text-gray-400 dark:text-gray-600 select-none">
      基于锐机智进数据库技术构建
    </p>
  );

  // ---------- 选题后的工作流视图 ----------
  if (topic) {
    return (
      <div className="w-full">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-blue-50/70 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs rounded-full font-medium">
                热搜专家模式
              </span>
              <span className="px-2 py-0.5 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs rounded-full border border-gray-200 dark:border-gray-700">
                {topic.platformName}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {topic.date} {formatTimeLabel(topic.time)} · 第 {topic.item.rank} 条
              </span>
              <button
                onClick={backToList}
                className="ml-auto px-3 py-1 text-xs text-gray-500 dark:text-gray-400 rounded-full hover:bg-white dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                返回热搜榜
              </button>
            </div>

            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mt-3 leading-snug">
              {topic.item.title}
            </h2>

            {/* 针对该热搜详细提问 */}
            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAsk();
                }}
                placeholder="针对该热搜详细提问（留空则直接搜索原热搜），如：事件起因、最新进展"
                className="flex-1 min-w-0 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-full px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all"
              />
              <button
                onClick={handleAsk}
                disabled={isLoading}
                className="shrink-0 px-5 py-2.5 bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-full hover:bg-gray-700 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? '检索中' : '提问'}
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                搜索词始终包含热搜原词，确保结果与该热搜相关
              </p>
              {topic.item.url && (
                <a
                  href={topic.item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  查看平台原页 ↗
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 原工作流：结果列表 + AI 总体概括 + 详情面板/弹窗 + AI 追问 */}
        <SearchResults showGLM={showGLM} allowFollowUp={allowFollowUp} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">{expertFooter}</div>
      </div>
    );
  }

  // ---------- 热搜榜视图 ----------
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* 日期 / 时间点选择 */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
        <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-xs rounded-full font-medium">
          锐机热搜专家
        </span>
        {dates.length > 0 && (
          <select
            value={date}
            onChange={handleDateChange}
            disabled={indexLoading}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-1.5 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all cursor-pointer disabled:opacity-60"
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {d}
                {d === dates[0] ? '（最新）' : ''}
              </option>
            ))}
          </select>
        )}
        {times.length > 1 && (
          <select
            value={time}
            onChange={handleTimeChange}
            disabled={archiveLoading}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-1.5 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all cursor-pointer disabled:opacity-60"
          >
            {times.map((t) => (
              <option key={t} value={t}>
                {formatTimeLabel(t)}
                {t === times[times.length - 1] ? '（最新）' : ''}
              </option>
            ))}
          </select>
        )}
        <span
          title={rankTooltip}
          className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full whitespace-nowrap cursor-default"
        >
          {speedTesting
            ? '节点测速中…'
            : bestEntry && bestNode
              ? `节点：${bestNode.label} ${formatLatency(bestEntry.latency)}`
              : '节点测速失败'}
        </span>
        <button
          onClick={handleSpeedTest}
          disabled={speedTesting || indexLoading || archiveLoading}
          className="px-4 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60 transition-colors"
        >
          重新测速
        </button>
        <button
          onClick={() => void loadIndex()}
          disabled={indexLoading || archiveLoading}
          className="px-4 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60 transition-colors"
        >
          刷新
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mb-6">
        选择日期与时间点查看各平台热搜榜，点击热搜词条即可进入检索与 AI 追问工作流
      </p>

      {/* 索引加载中 / 失败 / 空 */}
      {indexLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 animate-pulse h-64"
            />
          ))}
        </div>
      )}

      {!indexLoading && indexError && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
          <p className="text-red-600 dark:text-red-300 text-sm mb-3">{indexError}</p>
          <button
            onClick={() => void loadIndex()}
            className="px-5 py-2 bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-full hover:bg-gray-700 dark:hover:bg-white transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {!indexLoading && !indexError && (
        <>
          {archiveLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 animate-pulse h-64"
                />
              ))}
            </div>
          )}

          {!archiveLoading && archiveError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
              <p className="text-red-600 dark:text-red-300 text-sm mb-3">{archiveError}</p>
              <button
                onClick={() => void loadArchive(date, time)}
                className="px-5 py-2 bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-full hover:bg-gray-700 dark:hover:bg-white transition-colors"
              >
                重试
              </button>
            </div>
          )}

          {!archiveLoading && !archiveError && archive && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {PLATFORM_META.map(({ key, name }) => {
                  const data = archive.platforms[key];
                  if (!data || !data.success || data.list.length === 0) return null;
                  const expanded = expandedPlatforms.has(key);
                  const visibleItems = expanded ? data.list : data.list.slice(0, PREVIEW_COUNT);

                  return (
                    <div
                      key={key}
                      className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{name}</h3>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{data.list.length} 条</span>
                      </div>
                      <ul>
                        {visibleItems.map((item) => {
                          const hotText = formatHotValue(item.hot);
                          return (
                            <li key={`${item.rank}-${item.title}`}>
                              <button
                                onClick={() => handlePickItem(item, key, name)}
                                className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                              >
                                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs font-medium flex items-center justify-center">
                                  {item.rank}
                                </span>
                                <span className="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-200 truncate">
                                  {item.title}
                                </span>
                                {item.label && (
                                  <span className="shrink-0 text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                    {item.label}
                                  </span>
                                )}
                                {hotText && (
                                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500 w-14 text-right">
                                    {hotText}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {data.list.length > PREVIEW_COUNT && (
                        <button
                          onClick={() => togglePlatform(key)}
                          className="mt-1 w-full py-1.5 text-xs text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          {expanded ? '收起' : `展开全部 ${data.list.length} 条`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {PLATFORM_META.some(
                ({ key }) => archive.platforms[key] && !archive.platforms[key]!.success,
              ) && (
                <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
                  以下平台本次抓取失败：
                  {PLATFORM_META.filter(
                    ({ key }) => archive.platforms[key] && !archive.platforms[key]!.success,
                  ).map(({ name }) => name).join('、')}
                </p>
              )}
            </>
          )}
        </>
      )}
      {expertFooter}
    </div>
  );
}
