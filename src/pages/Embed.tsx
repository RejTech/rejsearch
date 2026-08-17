import { useMemo } from 'react';
import { SearchBar } from '../components/SearchBar';
import { SearchResults } from '../components/SearchResults';
import { LicenseButton } from '../components/LicenseButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { parseEmbedConfig } from '../lib/embedConfig';
import pkg from '../../package.json';

export default function Embed() {
  const config = useMemo(() => parseEmbedConfig(window.location.search), []);

  const showFooter = config.showVersion || config.showLicense;

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 transition-colors">
      <div className="flex-1 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <SearchBar
            showTitle={config.showTitle}
            redirectOnSearch={!config.allowInlineSearch}
            showAdvancedSearch={config.allowInlineSearch}
            showGLM={config.showGLM}
          />
          {config.allowInlineSearch && (
            <SearchResults showGLM={config.showGLM} allowFollowUp={config.showFollowUp} />
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
