import { create } from 'zustand';
import { SearchResult } from '../lib/anysearch';
import { SearchDirection } from '../lib/glm';

interface SearchStore {
  query: string;
  results: SearchResult[];
  total: number;
  isLoading: boolean;
  error: string | null;
  searchHistory: string[];
  selectedResult: SearchResult | null;
  
  // 总体概括
  overviewSummary: string;
  isOverviewLoading: boolean;
  
  // 单条详情概括
  detailSummary: string;
  isDetailLoading: boolean;

  // 高级搜索方向（Tags & Params）
  searchDirection: SearchDirection | null;
  isDirectionLoading: boolean;
  
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[], total: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addToHistory: (query: string) => void;
  removeFromHistory: (query: string) => void;
  clearHistory: () => void;
  selectResult: (result: SearchResult | null) => void;
  
  setOverviewSummary: (summary: string) => void;
  appendOverviewSummary: (chunk: string) => void;
  setOverviewLoading: (loading: boolean) => void;
  setDetailSummary: (summary: string) => void;
  appendDetailSummary: (chunk: string) => void;
  setDetailLoading: (loading: boolean) => void;

  setSearchDirection: (direction: SearchDirection | null) => void;
  setDirectionLoading: (loading: boolean) => void;
}

const STORAGE_KEY = 'anysearch_history';

const loadHistory = (): string[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveHistory = (history: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
};

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: '',
  results: [],
  total: 0,
  isLoading: false,
  error: null,
  searchHistory: loadHistory(),
  selectedResult: null,
  overviewSummary: '',
  isOverviewLoading: false,
  detailSummary: '',
  isDetailLoading: false,
  searchDirection: null,
  isDirectionLoading: false,

  setQuery: (query) => set({ query }),

  setResults: (results, total) => set({ results, total, error: null }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  addToHistory: (query) => {
    const { searchHistory } = get();
    const newHistory = [query, ...searchHistory.filter(q => q !== query)].slice(0, 10);
    saveHistory(newHistory);
    set({ searchHistory: newHistory });
  },

  removeFromHistory: (query) => {
    const { searchHistory } = get();
    const newHistory = searchHistory.filter(q => q !== query);
    saveHistory(newHistory);
    set({ searchHistory: newHistory });
  },

  clearHistory: () => {
    saveHistory([]);
    set({ searchHistory: [] });
  },

  selectResult: (result) => set({ selectedResult: result }),

  setOverviewSummary: (overviewSummary) => set({ overviewSummary }),
  appendOverviewSummary: (chunk) => set((state) => ({ overviewSummary: state.overviewSummary + chunk })),
  setOverviewLoading: (isOverviewLoading) => set({ isOverviewLoading }),
  setDetailSummary: (detailSummary) => set({ detailSummary }),
  appendDetailSummary: (chunk) => set((state) => ({ detailSummary: state.detailSummary + chunk })),
  setDetailLoading: (isDetailLoading) => set({ isDetailLoading }),

  setSearchDirection: (searchDirection) => set({ searchDirection }),
  setDirectionLoading: (isDirectionLoading) => set({ isDirectionLoading }),
}));
