// 数据仓库 RejTech/RejHotSearchDB 的 GitHub Actions 运行状态。
// 浏览器不直连 GitHub，走同源代理 /api/gh-actions（开发：Vite；生产：Netlify 边缘）。

/** 归一化后的运行状态 */
export type ActionRunState = 'success' | 'failure' | 'running' | 'cancelled' | 'unknown';

export interface ActionRunStatus {
  state: ActionRunState;
  /** 状态中文文案 */
  label: string;
  /** 最近一次运行的页面地址（点击徽章跳转） */
  url: string;
  /** 最近运行时间（毫秒时间戳），用于「x 分钟前」 */
  at: number | null;
}

const WORKFLOW_FILE = 'fetch-hot-search.yml';
const ACTIONS_PAGE = 'https://github.com/RejTech/RejHotSearchDB/actions';
const CACHE_TTL_MS = 60 * 1000;

interface GhRun {
  status: string;
  conclusion: string | null;
  html_url: string;
  run_started_at: string;
  updated_at: string;
}

let cache: { at: number; data: ActionRunStatus } | null = null;
let pending: Promise<ActionRunStatus> | null = null;

function normalize(run: GhRun | undefined): ActionRunStatus {
  if (!run) {
    return { state: 'unknown', label: '状态未知', url: ACTIONS_PAGE, at: null };
  }
  const at = new Date(run.run_started_at || run.updated_at).getTime() || null;
  if (run.status === 'completed') {
    switch (run.conclusion) {
      case 'success':
        return { state: 'success', label: '抓取成功', url: run.html_url, at };
      case 'failure':
        return { state: 'failure', label: '抓取失败', url: run.html_url, at };
      default:
        return { state: 'cancelled', label: '已取消', url: run.html_url, at };
    }
  }
  if (run.status === 'in_progress' || run.status === 'queued' || run.status === 'pending') {
    return { state: 'running', label: '正在抓取', url: run.html_url, at };
  }
  return { state: 'unknown', label: '状态未知', url: run.html_url || ACTIONS_PAGE, at };
}

/**
 * 获取数据抓取工作流最近一次运行状态（60 秒进程内缓存；force=true 强制刷新）。
 * 网络失败不抛错，返回 state='unknown'，避免阻断界面。
 */
export function fetchLatestActionRun(force = false): Promise<ActionRunStatus> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return Promise.resolve(cache.data);
  }
  if (!force && pending) return pending;

  pending = (async () => {
    try {
      const res = await fetch(
        `/api/gh-actions/workflows/${WORKFLOW_FILE}/runs?per_page=1&_t=${Date.now()}`,
        { headers: { Accept: 'application/vnd.github+json' } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { workflow_runs?: GhRun[] };
      const data = normalize(json.workflow_runs?.[0]);
      cache = { at: Date.now(), data };
      return data;
    } catch {
      return { state: 'unknown', label: '状态未知', url: ACTIONS_PAGE, at: null };
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/** 相对时间：刚刚 / x 分钟前 / x 小时前 / x 天前 */
export function formatRelativeTime(ts: number | null, now = Date.now()): string {
  if (ts == null) return '';
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}
