import { create } from 'zustand';

type ThemeMode = 'light' | 'dark' | 'auto';
type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'rejsearch_theme';

const getSystemTheme = (): EffectiveTheme => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyThemeClass = (theme: EffectiveTheme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

const resolveTheme = (mode: ThemeMode): EffectiveTheme =>
  mode === 'auto' ? getSystemTheme() : mode;

const loadMode = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'auto') return stored;
  } catch {
    // ignore
  }
  return 'auto';
};

interface ThemeStore {
  mode: ThemeMode;
  theme: EffectiveTheme;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
  syncFromSystem: () => void;
}

const initialMode = loadMode();
const initialTheme = resolveTheme(initialMode);
applyThemeClass(initialTheme);

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: initialMode,
  theme: initialTheme,
  toggle: () => {
    const order: ThemeMode[] = ['light', 'dark', 'auto'];
    const idx = order.indexOf(get().mode);
    const next = order[(idx + 1) % order.length];
    const nextTheme = resolveTheme(next);
    applyThemeClass(nextTheme);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    set({ mode: next, theme: nextTheme });
  },
  setMode: (m) => {
    const nextTheme = resolveTheme(m);
    applyThemeClass(nextTheme);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignore
    }
    set({ mode: m, theme: nextTheme });
  },
  syncFromSystem: () => {
    if (get().mode !== 'auto') return;
    const next = getSystemTheme();
    applyThemeClass(next);
    set({ theme: next });
  },
}));

// 监听系统主题变化，auto 模式下实时同步
if (typeof window !== 'undefined' && window.matchMedia) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => useThemeStore.getState().syncFromSystem();
  if (mql.addEventListener) {
    mql.addEventListener('change', listener);
  } else if ((mql as any).addListener) {
    (mql as any).addListener(listener);
  }
}
