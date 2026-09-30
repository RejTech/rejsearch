// 锐机热搜库（RejHotSearchDB）客户端
// 数据仓库: https://github.com/RejTech/RejHotSearchDB
// 浏览器不直连 GitHub，统一走同源加速节点（开发：Vite 代理；生产：Netlify 边缘代理）：
//   /api/hotsearch-raw       → raw.githubusercontent.com（GitHub 直连，内容最新）
//   /api/hotsearch-ghproxy   → gh-proxy.com 公益加速（/<完整 raw URL>）
//   /api/hotsearch-fastly    → fastly.jsdelivr.net（jsDelivr Fastly 边缘）
//   /api/hotsearch-gcore     → gcore.jsdelivr.net（jsDelivr Gcore 边缘）
// 首次使用时并发请求各节点的 index.json 自动测速，后续优先使用最快节点，
// 失败自动降级到次快节点；测速结果缓存 30 分钟（localStorage），可手动重新测速。
// 路径拼接规则（见仓库 README）：
//   索引: {basePath}/index.json
//   归档: {basePath}/{date}/{time}.json，date=YYYY-MM-DD，time=HH-mm

/** 单个同源加速节点 */
export interface HotSearchNode {
  key: string;
  label: string;
  basePath: string;
}

/**
 * 节点定义。顺序仅作为「全部测速失败」时的兜底尝试顺序，
 * 正常情况下使用由实测延迟决定的动态排序。
 */
export const HOTSEARCH_NODES: HotSearchNode[] = [
  { key: 'raw', label: 'GitHub 直连', basePath: '/api/hotsearch-raw' },
  { key: 'ghproxy', label: 'gh-proxy 加速', basePath: '/api/hotsearch-ghproxy' },
  { key: 'fastly', label: 'jsDelivr Fastly', basePath: '/api/hotsearch-fastly' },
  { key: 'gcore', label: 'jsDelivr Gcore', basePath: '/api/hotsearch-gcore' },
];

/** 单节点测速结果；latency=null 表示该节点测速失败（超时/非 200/响应异常） */
export interface NodeRankEntry {
  key: string;
  latency: number | null;
}

/** 一次完整测速的结果 */
export interface NodeRankResult {
  at: number;                // 测速时间戳
  entries: NodeRankEntry[]; // 成功节点按延迟升序在前，失败节点按默认顺序沉尾
}

const RANK_STORAGE_KEY = 'hotsearch_node_rank_v1';
const RANK_TTL_MS = 30 * 60 * 1000;     // 测速结果有效期 30 分钟
const SPEEDTEST_TIMEOUT_MS = 8000;      // 单节点测速超时
const MAX_ATTEMPTS_PER_NODE = 2;        // 正式请求单节点最多尝试次数
const RETRY_DELAY_MS = 350;

/** 进行中的测速 Promise，保证并发调用方共用一次测速 */
let rankPromise: Promise<NodeRankResult> | null = null;
/** 本会话内正式请求连续失败的节点，临时沉底（重新测速成功后清空） */
const sessionBadKeys = new Set<string>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 探测单个节点：并发拉取极小的 index.json，以完整收到响应的耗时作为延迟 */
async function probeNode(node: HotSearchNode): Promise<NodeRankEntry> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SPEEDTEST_TIMEOUT_MS);
  const startedAt = performance.now();
  try {
    const response = await fetch(`${node.basePath}/index.json?t=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) return { key: node.key, latency: null };
    // gh-proxy 等节点 content-type 可能是 text/plain，以实际 JSON 结构为准
    const data = (await response.json()) as { dates?: unknown };
    if (!data || typeof data.dates !== 'object') return { key: node.key, latency: null };
    return { key: node.key, latency: Math.round(performance.now() - startedAt) };
  } catch {
    return { key: node.key, latency: null };
  } finally {
    clearTimeout(timer);
  }
}

/** 并发测试全部节点，生成「快→慢/失败」的排序并持久化（至少一个节点可用时） */
export async function speedTestNodes(): Promise<NodeRankResult> {
  const probes = await Promise.all(HOTSEARCH_NODES.map(probeNode));
  const succeeded = probes
    .filter((entry): entry is { key: string; latency: number } => entry.latency !== null)
    .sort((a, b) => a.latency - b.latency);
  const succeededKeys = new Set(succeeded.map((entry) => entry.key));
  const failed: NodeRankEntry[] = HOTSEARCH_NODES.filter((node) => !succeededKeys.has(node.key))
    .map((node) => ({ key: node.key, latency: null }));

  const result: NodeRankResult = { at: Date.now(), entries: [...succeeded, ...failed] };
  if (succeeded.length > 0) persistRank(result);
  sessionBadKeys.clear();
  return result;
}

function readStoredRank(): NodeRankResult | null {
  try {
    const raw = localStorage.getItem(RANK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NodeRankResult;
    if (!parsed || !Array.isArray(parsed.entries) || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > RANK_TTL_MS) return null;
    // 旧版本残留或节点列表变更后直接作废
    const validKeys = new Set(HOTSEARCH_NODES.map((node) => node.key));
    if (parsed.entries.length !== HOTSEARCH_NODES.length ||
        parsed.entries.some((entry) => !validKeys.has(entry.key))) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistRank(rank: NodeRankResult): void {
  try {
    localStorage.setItem(RANK_STORAGE_KEY, JSON.stringify(rank));
  } catch {
    // 隐私模式 / 存储被禁用时静默忽略
  }
}

/**
 * 获取节点排序：优先用 30 分钟内的测速缓存，否则立即并发测速。
 * @param force 跳过缓存强制重新测速（用户点击「重新测速」时使用）
 */
export function getNodeRanking(force = false): Promise<NodeRankResult> {
  if (!force && rankPromise) return rankPromise;
  if (!force) {
    const stored = readStoredRank();
    if (stored) {
      rankPromise = Promise.resolve(stored);
      return rankPromise;
    }
  }
  rankPromise = speedTestNodes();
  return rankPromise;
}

/** 按测速结果返回节点顺序，失败节点沉尾、会话内连续失败的节点沉底 */
async function getOrderedNodes(): Promise<HotSearchNode[]> {
  const { entries } = await getNodeRanking();
  const byKey = new Map(HOTSEARCH_NODES.map((node) => [node.key, node]));
  const ordered: HotSearchNode[] = [];
  for (const entry of entries) {
    const node = byKey.get(entry.key);
    if (node) ordered.push(node);
  }
  // 兜底：测速结果缺漏的节点按默认顺序补齐
  for (const node of HOTSEARCH_NODES) {
    if (!ordered.some((item) => item.key === node.key)) ordered.push(node);
  }
  // 稳定排序：仅区分好/坏两组，组内保持测速顺序
  ordered.sort(
    (a, b) => Number(sessionBadKeys.has(a.key)) - Number(sessionBadKeys.has(b.key)),
  );
  return ordered;
}

/** 延迟展示：>=1000ms 用秒 */
export function formatLatency(latency: number | null): string {
  if (latency === null) return '不可用';
  if (latency >= 1000) return `${(latency / 1000).toFixed(1)}s`;
  return `${latency}ms`;
}

/**
 * 按测速后的节点顺序依次请求，每个节点最多重试 2 次（应对间歇性 TLS 重置）；
 * 任一节点成功即返回，全部失败才抛错。
 */
async function fetchJson<T>(relativePath: string): Promise<T> {
  const nodes = await getOrderedNodes();
  let lastErrorMessage = '热搜数据加载失败，请稍后重试';

  for (const node of nodes) {
    let succeeded = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_NODE; attempt++) {
      try {
        const response = await fetch(`${node.basePath}${relativePath}`);
        if (response.ok) {
          const json = (await response.json()) as T;
          succeeded = true;
          sessionBadKeys.delete(node.key);
          return json;
        }
        // 4xx（如镜像边缘暂时未缓存）与 5xx 均允许重试 / 切换下一节点
        lastErrorMessage = `热搜数据加载失败（HTTP ${response.status}）`;
      } catch {
        // 网络错误（DNS / 连接被重置 / 超时等）
        lastErrorMessage = '网络连接失败，请检查网络后重试';
      }
      if (attempt < MAX_ATTEMPTS_PER_NODE) await sleep(RETRY_DELAY_MS);
    }
    if (!succeeded) sessionBadKeys.add(node.key);
  }
  throw new Error(lastErrorMessage);
}

/** 热搜平台标识（与 RejHotSearchDB scripts/fetch.js 的 PLATFORMS 键一致） */
export type HotSearchPlatform =
  | 'weibo'
  | 'zhihu'
  | 'baidu'
  | 'bilibili'
  | 'douyin'
  | 'toutiao';

/** 单条热搜条目 */
export interface HotSearchItem {
  rank: number;            // 榜单排名（从 1 开始）
  title: string;           // 热搜标题（作为搜索关键词使用）
  hot: number | string;    // 热度值（多数平台为数字，百度/知乎可能为字符串或空）
  url: string;            // 平台原生日志链接
  label: string;           // 标签，如 "热" / "新" / "置顶"，可能为空
}

/** 单平台归档数据 */
export interface PlatformHotSearch {
  success: boolean;
  error?: string;          // 抓取失败原因（单平台失败不影响其他平台）
  list: HotSearchItem[];
}

/** 某个时间点的完整归档 */
export interface HotSearchArchive {
  date: string;            // YYYY-MM-DD（北京时间）
  time: string;            // HH-mm（北京时间）
  timestamp: number;       // 抓取时间戳
  platforms: Partial<Record<HotSearchPlatform, PlatformHotSearch>>;
}

/** archives/index.json 索引 */
export interface HotSearchIndex {
  updated: number;
  dates: Record<string, string[]>; // date -> 可用时间点列表，如 {"2026-10-01": ["01-07","01-08"]}
}

/** 平台元数据（按固定顺序展示） */
export const PLATFORM_META: { key: HotSearchPlatform; name: string }[] = [
  { key: 'weibo', name: '微博热搜' },
  { key: 'zhihu', name: '知乎热榜' },
  { key: 'baidu', name: '百度实时热点' },
  { key: 'bilibili', name: '哔哩哔哩热搜' },
  { key: 'douyin', name: '抖音热榜' },
  { key: 'toutiao', name: '今日头条热榜' },
];

/** 归档不可变，做进程内缓存，切换日期/时间点时避免重复请求 */
const archiveCache = new Map<string, HotSearchArchive>();

/** 获取索引：所有可用日期与时间点 */
export async function fetchHotSearchIndex(): Promise<HotSearchIndex> {
  const data = await fetchJson<HotSearchIndex>('/index.json');
  if (!data || !data.dates || typeof data.dates !== 'object') {
    throw new Error('热搜索引格式异常');
  }
  return data;
}

/** 获取指定日期、时间点的归档 */
export async function fetchHotSearchArchive(date: string, time: string): Promise<HotSearchArchive> {
  const cacheKey = `${date}/${time}`;
  const cached = archiveCache.get(cacheKey);
  if (cached) return cached;

  const archive = await fetchJson<HotSearchArchive>(`/${date}/${time}.json`);
  if (!archive || !archive.platforms) {
    throw new Error('热搜归档格式异常');
  }
  archiveCache.set(cacheKey, archive);
  return archive;
}

/** 索引中的日期按倒序排列（最新在前）；key 由数据端统一生成，前端不做任何时区加工 */
export function getSortedDates(index: HotSearchIndex): string[] {
  return Object.keys(index.dates).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

/** 某日期下的时间点按时间正序排列，末尾为最新 */
export function getSortedTimes(index: HotSearchIndex, date: string): string[] {
  return [...(index.dates[date] ?? [])].sort();
}

/** "01-26" -> "01:26"（仅展示用，回传仍用原始 key） */
export function formatTimeLabel(time: string): string {
  return time.replace('-', ':');
}

/** 热度值展示：数字过万转为「万」，字符串（百度/知乎）原样展示 */
export function formatHotValue(hot: number | string | undefined): string {
  if (hot === undefined || hot === null || hot === '') return '';
  if (typeof hot === 'number') {
    if (hot >= 10000) return `${(hot / 10000).toFixed(1).replace(/\.0$/, '')}万`;
    return String(hot);
  }
  return String(hot);
}
