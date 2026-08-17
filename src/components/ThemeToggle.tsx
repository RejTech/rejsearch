import { useThemeStore } from '../store/themeStore';

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      title={isDark ? '切换到浅色模式' : '切换到深色模式'}
      className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
    >
      <span className="text-base leading-none">{isDark ? '☀' : '☾'}</span>
      <span>{isDark ? '浅色' : '深色'}</span>
    </button>
  );
}
