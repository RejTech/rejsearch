import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchStore } from '../store/searchStore';
import { search } from '../lib/anysearch';
import { summarizeOverview, summarizePlatformBrief } from '../lib/glm';
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
  /** 桌面：双列卡片+原地展开；WAP：平台折叠列表+底部弹窗展开 */
  variant?: 'desktop' | 'wap';
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

export function HotSearchExpert({ showGLM = true, variant = 'desktop' }: HotSearchExpertProps = {}) {
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
    beginOverviewSession,
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
  /** WAP 形态：当前以底部弹窗展开的平台（null=全部折叠） */
  const [sheetPlatform, setSheetPlatform] = useState<HotSearchPlatform | null>(null);
  /** WAP 形态：各平台折叠卡上的 AI 一句话概览（key 为「日期-时间点-平台」） */
  const [platformBriefs, setPlatformBriefs] = useState<Record<string, string>>({});
  /** WAP 榜单视图：当前展开的顶部悬浮面板（null=全部收起） */
  const [wapPanel, setWapPanel] = useState<'time' | 'advanced' | null>(null);

  // WAP 形态：榜单就绪后为各平台折叠卡异步生成 AI 一句话概览（GLM-4-Flash，同榜缓存只调一次）
  useEffect(() => {
    if (variant !== 'wap' || !archive) return;
    let cancelled = false;
    PLATFORM_META.forEach(({ key, name }) => {
      const data = archive.platforms[key];
      if (!data || !data.success || data.list.length === 0) return;
      const cacheKey = `${archive.date}-${archive.time}-${key}`;
      summarizePlatformBrief(cacheKey, name, data.list.map((it) => it.title))
        .then((brief) => {
          if (!cancelled && brief) {
            setPlatformBriefs((prev) => (prev[cacheKey] === brief ? prev : { ...prev, [cacheKey]: brief }));
          }
        })
        .catch(() => {
          // 生成失败：折叠卡保持回退文案（首条预览 + 条数）
        });
    });
    return () => {
      cancelled = true;
    };
  }, [archive, variant]);

  /** 单条热搜条目渲染（桌面卡片与 WAP 弹窗共用），外层 li 由调用方包裹 */
  const renderHotItem = (item: HotSearchItem, key: HotSearchPlatform, name: string) => {
    const hotText = formatHotValue(item.hot);
    return (
      <button
        onClick={() => handlePickItem(item, key, name)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-full text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
      >
        <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs font-medium flex items-center justify-center">
          {item.rank}
        </span>
        <span className="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-200 truncate">
          {item.title}
        </span>
        {item.label && (
          <span
            title={item.label}
            className="shrink-0 max-w-[38%] truncate text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            {item.label}
          </span>
        )}
        {hotText && (
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500 w-14 text-right">
            {hotText}
          </span>
        )}
      </button>
    );
  };

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
   * 执行热搜检索：进入原有工作流（AnySearch 搜索 → 结果列表 → GLM 总体概括 → 详情）。
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
    // 开启新概括会话：清空旧概括并作废进行中的旧流（连续检索时两路概括不再混合）
    const overviewSession = beginOverviewSession();
    setError(null);
    selectResult(null);

    try {
      const response = await search({ query: q, maxResults: 20 });
      setResults(response.results, response.total);

      if (showGLM) {
        setOverviewLoading(true, overviewSession);
        summarizeOverview(q, response.results, (chunk) => appendOverviewSummary(chunk, overviewSession))
          .catch(() => setOverviewSummary('AI 总体概括生成失败，请稍后重试', overviewSession))
          .finally(() => setOverviewLoading(false, overviewSession));
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
    setSheetPlatform(null); // 从 WAP 弹窗进入工作流时收起弹窗，返回榜单时不再自动弹出
    setQuestion('');
    void executeSearch(item, platform, platformName, '', { date, time });
  };

  /** 针对当前热搜的详细提问：热搜原词 + 问题 */
  const handleAsk = () => {
    if (!topic) return;
    void executeSearch(topic.item, topic.platform, topic.platformName, question, topic);
  };

  /** 返回热搜榜，清空工作流状态（同时作废进行中的概括流） */
  const backToList = () => {
    setTopic(null);
    setQuestion('');
    setResults([], 0);
    beginOverviewSession();
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

  // 测速后首位的可用节点（先按索引新鲜度、再按延迟排序）
  const bestEntry = rank?.entries.find((entry) => entry.latency !== null) ?? null;
  const bestNode = bestEntry
    ? HOTSEARCH_NODES.find((node) => node.key === bestEntry.key) ?? null
    : null;
  /** 悬停节点胶囊时展示全部节点测速结果，并标注索引数据新旧 */
  const rankTooltip = rank
    ? (() => {
        const freshUpdated = Math.max(
          ...rank.entries.map((entry) => entry.updated ?? -Infinity),
        );
        return rank.entries
          .map((entry) => {
            const node = HOTSEARCH_NODES.find((item) => item.key === entry.key);
            let freshness = '';
            if (entry.latency !== null && entry.updated !== null) {
              freshness = entry.updated >= freshUpdated ? '（最新）' : '（数据滞后）';
            }
            return `${node?.label ?? entry.key}：${formatLatency(entry.latency)}${freshness}`;
          })
          .join('\n');
      })()
    : '';

  // 专家页面底部技术来源标注（榜单视图与工作流视图均展示）
  const expertFooter = (
    <p className="mt-10 mb-2 text-center text-xs text-gray-400 dark:text-gray-600 select-none">
      基于锐机智进数据库技术构建
    </p>
  );

  // ---------- 选题后的工作流视图 ----------
  if (topic) {
    const isWap = variant === 'wap';
    return (
      <div className={`w-full ${isWap ? 'pt-[calc(env(safe-area-inset-top)+4.5rem)]' : ''}`}>
        {/* WAP：返回按钮悬浮于左上角，平台原页悬浮于右上角（与返回同款胶囊） */}
        {isWap && (
          <button
            onClick={backToList}
            className="liquid-glass fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 rounded-full px-3.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-200"
          >
            ‹ 返回热搜榜
          </button>
        )}
        {isWap && topic.item.url && (
          <a
            href={topic.item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="liquid-glass fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 rounded-full px-3.5 py-2 text-xs font-medium text-blue-600 dark:text-blue-300"
          >
            平台原页 ↗
          </a>
        )}

        {/* WAP：置底「详细提问」药丸已移除（追问功能已移除） */}

        <div className={`w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8${isWap ? ' pt-12' : ''}`}>
          {/* 热搜信息卡：LiquidGlass + 右上光斑，徽章行（模式/平台/时间/排名）+ 大标题；容器 24px 圆角，徽章行统一胶囊高度对齐 */}
          <div className="liquid-glass rounded-3xl p-4 sm:p-5 relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-blue-400/15 dark:bg-blue-500/10 blur-2xl"
            />
            <div className="relative flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs rounded-full font-medium">
                热搜专家模式
              </span>
              <span className="inline-flex items-center px-2.5 py-1 bg-white/70 dark:bg-gray-800/70 text-gray-600 dark:text-gray-300 text-xs rounded-full border border-white/70 dark:border-gray-700">
                {topic.platformName}
              </span>
              <span className="ml-auto inline-flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span className="tabular-nums">
                  {topic.date} {formatTimeLabel(topic.time)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/40 px-2.5 py-1 text-blue-600 dark:text-blue-300">
                  第
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/80 text-[10px] font-semibold leading-none">
                    {topic.item.rank}
                  </span>
                  条
                </span>
              </span>
              {!isWap && (
                <button
                  onClick={backToList}
                  className="inline-flex items-center px-3 py-1 text-xs text-gray-500 dark:text-gray-400 rounded-full border border-gray-200/70 dark:border-gray-700 bg-white/60 dark:bg-gray-800/70 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  返回热搜榜
                </button>
              )}
            </div>

            <h2 className="relative mt-3 text-xl font-semibold leading-snug tracking-tight text-gray-800 dark:text-gray-100">
              {topic.item.title}
            </h2>

            {/* 针对该热搜详细提问（仅桌面形态；WAP 已置底悬浮） */}
            {!isWap && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* 原工作流：结果列表 + AI 总体概括 + 详情面板/弹窗 */}
        <SearchResults showGLM={showGLM} variant={isWap ? 'wap' : 'desktop'} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">{expertFooter}</div>
        {isWap && <div aria-hidden className="h-36" />}
      </div>
    );
  }

  // ---------- 热搜榜视图 ----------
  const isWapList = variant === 'wap';
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* WAP：顶部悬浮按钮组 + 下拉面板（收纳日期/时间点/刷新 与 节点/测速） */}
      {isWapList && (
        <>
          <div className="fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex items-center gap-2">
            {(
              [
                { key: 'time', label: '选择时间' },
                { key: 'advanced', label: '高级选项' },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setWapPanel(wapPanel === key ? null : key)}
                className={`liquid-glass rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
                  wapPanel === key
                    ? 'text-blue-600 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {wapPanel && (
            <>
              {/* 透明遮罩：点击面板外任意处收起 */}
              <div className="fixed inset-0 z-40" onClick={() => setWapPanel(null)} />
              {/* 同心圆：容器圆角 32px = 内边距 12px + 内层胶囊圆角 20px，面板圆弧与内部胶囊共用圆心 */}
              <div className="liquid-glass animate-panel-in fixed left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+2.75rem)] z-50 mx-auto max-w-sm rounded-[32px] p-3">
                {wapPanel === 'time' ? (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1 px-2 text-[10px] text-gray-400 dark:text-gray-500">日期</p>
                      {dates.length > 0 ? (
                        <select
                          value={date}
                          onChange={handleDateChange}
                          disabled={indexLoading}
                          className="select-chevron w-full cursor-pointer rounded-full border border-gray-200/70 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 pl-4 pr-10 py-2.5 text-sm text-gray-700 dark:text-gray-200 outline-none disabled:opacity-60"
                        >
                          {dates.map((d) => (
                            <option key={d} value={d}>
                              {d}
                              {d === dates[0] ? '（最新）' : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="px-2 text-xs text-gray-400">暂无归档日期</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1 px-2 text-[10px] text-gray-400 dark:text-gray-500">时间点</p>
                      {times.length > 1 ? (
                        <select
                          value={time}
                          onChange={handleTimeChange}
                          disabled={archiveLoading}
                          className="select-chevron w-full cursor-pointer rounded-full border border-gray-200/70 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 pl-4 pr-10 py-2.5 text-sm text-gray-700 dark:text-gray-200 outline-none disabled:opacity-60"
                        >
                          {times.map((t) => (
                            <option key={t} value={t}>
                              {formatTimeLabel(t)}
                              {t === times[times.length - 1] ? '（最新）' : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="px-2 text-xs text-gray-400">当日仅有一个归档时间点</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        void loadIndex();
                        setWapPanel(null);
                      }}
                      disabled={indexLoading || archiveLoading}
                      className="w-full rounded-full bg-gray-800/90 dark:bg-gray-100 px-4 py-2.5 text-sm text-white dark:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      刷新数据
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <span
                      title={rankTooltip}
                      className="block cursor-default truncate rounded-full border border-gray-200/70 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 px-4 py-2.5 text-center text-xs text-gray-500 dark:text-gray-400"
                    >
                      {speedTesting
                        ? '节点测速中…'
                        : bestEntry && bestNode
                          ? `节点：${bestNode.label} ${formatLatency(bestEntry.latency)}`
                          : '节点测速失败'}
                    </span>
                    <button
                      onClick={() => handleSpeedTest()}
                      disabled={speedTesting || indexLoading || archiveLoading}
                      className="w-full rounded-full border border-gray-200/70 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {speedTesting ? '测速中…' : '重新测速'}
                    </button>
                    <button
                      onClick={() => {
                        void loadIndex();
                        setWapPanel(null);
                      }}
                      disabled={indexLoading || archiveLoading}
                      className="w-full rounded-full border border-gray-200/70 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      刷新数据
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {isWapList ? (
        /* WAP：顶部为悬浮按钮组，内容区下移让位；说明压缩为一行 */
        <>
        </>
      ) : (
        <>
          {/* 桌面：日期 / 时间点 / 节点控制区（保持内联展示） */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
            <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-xs rounded-full font-medium">
              锐机热搜专家
            </span>
            {dates.length > 0 && (
              <select
                value={date}
                onChange={handleDateChange}
                disabled={indexLoading}
                className="select-chevron bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full pl-4 pr-10 py-1.5 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all cursor-pointer disabled:opacity-60"
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
                className="select-chevron bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full pl-4 pr-10 py-1.5 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-all cursor-pointer disabled:opacity-60"
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
            选择日期与时间点查看各平台热搜榜，点击热搜词条即可进入检索工作流
          </p>
        </>
      )}

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
              {variant === 'wap' ? (
                /* WAP 形态：平台折叠列表，点击后以底部弹窗展开；抓取失败的平台直接隐藏 */
                (() => {
                  const availablePlatforms = PLATFORM_META.filter(({ key }) => {
                    const data = archive.platforms[key];
                    return data && data.success && data.list.length > 0;
                  });
                  return (
                    <div className="flex min-h-[calc(100dvh-15rem)] flex-col justify-center pt-[calc(env(safe-area-inset-top)+5.5rem)]">
                      {availablePlatforms.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 dark:text-gray-500">
                          本期暂无可用榜单
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {availablePlatforms.map(({ key, name }) => {
                            const data = archive.platforms[key];
                            const preview = data.list[0].title;
                            const count = data.list.length;
                            const brief = platformBriefs[`${archive.date}-${archive.time}-${key}`];
                            return (
                              <button
                                key={key}
                                onClick={() => setSheetPlatform(key)}
                                className="w-full flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full px-4 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
                              >
                                <span className="shrink-0 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                  {name}
                                </span>
                                <span className="flex-1 min-w-0 text-xs text-gray-400 dark:text-gray-500 truncate">
                                  {brief ? (
                                    <span className="flex min-w-0 items-center gap-1.5">
                                      <span className="shrink-0 rounded bg-blue-50 px-1 py-0.5 text-[9px] font-medium leading-none text-blue-500 dark:bg-blue-900/40 dark:text-blue-300">
                                        AI
                                      </span>
                                      <span className="truncate">{brief}</span>
                                    </span>
                                  ) : (
                                    <span className="truncate">{`${preview} 等 ${count} 条`}</span>
                                  )}
                                </span>
                                <span className="shrink-0 text-xs text-blue-600 dark:text-blue-400">查看 ›</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
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
                          {visibleItems.map((item) => (
                            <li key={`${item.rank}-${item.title}`}>{renderHotItem(item, key, name)}</li>
                          ))}
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
              )}

              {variant !== 'wap' && PLATFORM_META.some(
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

      {/* WAP 形态：平台热搜底部弹窗 */}
      {variant === 'wap' && sheetPlatform && archive && (() => {
        const meta = PLATFORM_META.find((m) => m.key === sheetPlatform);
        const data = archive.platforms[sheetPlatform];
        if (!meta || !data || !data.success) return null;
        return (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSheetPlatform(null)}
            />
            <div className="animate-sheet-up absolute inset-x-0 bottom-0 flex flex-col max-h-[80dvh] bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{meta.name}</h3>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    {archive.date} {formatTimeLabel(archive.time)} · {data.list.length} 条 · 点击词条进入检索
                  </p>
                </div>
                <button
                  onClick={() => setSheetPlatform(null)}
                  className="shrink-0 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  关闭
                </button>
              </div>
              <ul className="flex-1 overflow-y-auto px-2 py-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {data.list.map((item) => (
                  <li key={`${item.rank}-${item.title}`}>{renderHotItem(item, sheetPlatform, meta.name)}</li>
                ))}
              </ul>
            </div>
          </div>
        );
      })()}

      {expertFooter}
    </div>
  );
}
