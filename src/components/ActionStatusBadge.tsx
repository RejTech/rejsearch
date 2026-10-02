import { useEffect, useState } from 'react';
import {
  fetchLatestActionRun,
  formatRelativeTime,
  type ActionRunState,
  type ActionRunStatus,
} from '../lib/ghactions';

const DOT_CLASS: Record<ActionRunState, string> = {
  success: 'bg-green-500',
  failure: 'bg-red-500',
  running: 'bg-amber-400 animate-pulse',
  cancelled: 'bg-gray-400',
  unknown: 'bg-gray-400',
};

/**
 * GitHub Actions 数据抓取任务状态徽章（热搜「选择时间」面板内）。
 * 面板每次展开都会重新挂载，自动拉取最近一次运行（库内 60s 缓存）。
 */
export function ActionStatusBadge() {
  const [status, setStatus] = useState<ActionRunStatus | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchLatestActionRun().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <a
      href={status?.url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      title="在 GitHub 查看 Actions 运行详情"
      className="flex w-full items-center gap-2 rounded-full border border-gray-200/70 bg-white/70 px-4 py-2.5 text-xs transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/60 dark:hover:bg-gray-800/60"
    >
      <span className="shrink-0 text-gray-500 dark:text-gray-400">自动抓取</span>
      {status ? (
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-gray-500 dark:text-gray-400">
          <span className={`h-2 w-2 rounded-full ${DOT_CLASS[status.state]}`} />
          <span
            className={
              status.state === 'success'
                ? 'text-green-600 dark:text-green-400'
                : status.state === 'failure'
                  ? 'text-red-600 dark:text-red-400'
                  : status.state === 'running'
                    ? 'text-amber-600 dark:text-amber-400'
                    : ''
            }
          >
            {status.label}
          </span>
          {status.at != null && <span className="text-gray-400 dark:text-gray-500">· {formatRelativeTime(status.at)}</span>}
        </span>
      ) : (
        <span className="ml-auto h-4 w-28 animate-pulse rounded-full bg-gray-200/70 dark:bg-gray-700/70" />
      )}
    </a>
  );
}
