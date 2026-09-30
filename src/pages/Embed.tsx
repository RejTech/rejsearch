import { useMemo, useState } from 'react';
import { SearchBar } from '../components/SearchBar';
import { SearchResults } from '../components/SearchResults';
import { HotSearchExpert } from '../components/HotSearchExpert';
import { LicenseButton } from '../components/LicenseButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { parseEmbedConfig } from '../lib/embedConfig';
import pkg from '../../package.json';

type EmbedMode = 'search' | 'hot';

export default function Embed() {
  const config = useMemo(() => parseEmbedConfig(window.location.search), []);
  const [mode, setMode] = useState<EmbedMode>('search');

  const showFooter = config.showVersion || config.showLicense;
  // 热搜专家依赖内嵌内搜索能力
  const showHotTab = config.showHotSearch && config.allowInlineSearch;

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 transition-colors">
      <div className="flex-1 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {showHotTab && (
            <div className="flex justify-center mb-4">
              <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-full p-1">
                <button
                  onClick={() => setMode('search')}
                  className={`px-5 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                    mode === 'search'
                      ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  超级搜索
                </button>
                <button
                  onClick={() => setMode('hot')}
                  className={`px-5 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                    mode === 'hot'
                      ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  热搜专家
                </button>
              </div>
            </div>
          )}

          {(!showHotTab || mode === 'search') ? (
            <>
              <SearchBar
                showTitle={config.showTitle}
                redirectOnSearch={!config.allowInlineSearch}
                showAdvancedSearch={config.allowInlineSearch}
                showGLM={config.showGLM}
              />
              {config.allowInlineSearch && (
                <SearchResults showGLM={config.showGLM} allowFollowUp={config.showFollowUp} />
              )}
            </>
          ) : (
            <HotSearchExpert showGLM={config.showGLM} allowFollowUp={config.showFollowUp} />
          )}
        </div>
      </div>

      {showFooter && (
        <footer className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-4 px-4 transition-colors">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              {config.showVersion && (
                <span className="text-gray-500 dark:text-gray-400 text-sm">版本 {pkg.version}</span>
              )}
              <ThemeToggle />
            </div>
            {config.showLicense && <LicenseButton />}
          </div>
        </footer>
      )}
    </div>
  );
}
