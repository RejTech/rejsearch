import { useThemeStore } from '../store/themeStore';

export function ThemeToggle() {
  const { mode, theme, toggle } = useThemeStore();

  const label =
    mode === 'auto'
      ? `自动（${theme === 'dark' ? '深色' : '浅色'}）`
      : mode === 'dark'
        ? '深色'
        : '浅色';

  const icon = mode === 'auto' ? '◐' : theme === 'dark' ? '☾' : '☀';

  return (
    <button
      onClick={toggle}
      aria-label={`当前：${label}，点击切换`}
      title={`当前：${label}（点击切换 浅色 → 深色 → 跟随系统）`}
      className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
