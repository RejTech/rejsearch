import { create } from 'zustand';
import { SearchResult } from '../lib/anysearch';

interface SearchStore {
  query: string;
  results: SearchResult[];
  total: number;
  isLoading: boolean;
  error: string | null;
  searchHistory: string[];
  selectedResult: SearchResult | null;
  extractedContent: string;
  isExtracting: boolean;
  summary: string;
  isSummarizing: boolean;
  
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[], total: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addToHistory: (query: string) => void;
  removeFromHistory: (query: string) => void;
  clearHistory: () => void;
  selectResult: (result: SearchResult | null) => void;
  setExtractedContent: (content: string) => void;
  setExtracting: (extracting: boolean) => void;
  setSummary: (summary: string) => void;
  setSummarizing: (summarizing: boolean) => void;
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
  extractedContent: '',
  isExtracting: false,
  summary: '',
  isSummarizing: false,

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

  setExtractedContent: (content) => set({ extractedContent: content }),

  setExtracting: (extracting) => set({ isExtracting: extracting }),
  setSummary: (summary) => set({ summary }),
  setSummarizing: (summarizing) => set({ isSummarizing: summarizing }),
}));