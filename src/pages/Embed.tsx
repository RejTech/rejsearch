import { useMemo } from 'react';
import { SearchBar } from '../components/SearchBar';
import { SearchResults } from '../components/SearchResults';
import { LicenseButton } from '../components/LicenseButton';
import { parseEmbedConfig } from '../lib/embedConfig';
import pkg from '../../package.json';

export default function Embed() {
  const config = useMemo(() => parseEmbedConfig(window.location.search), []);

  const showFooter = config.showVersion || config.showLicense;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <SearchBar
            showTitle={config.showTitle}
            redirectOnSearch={!config.allowInlineSearch}
            showAdvancedSearch={config.allowInlineSearch}
            showGLM={config.showGLM}
          />
          {config.allowInlineSearch && <SearchResults showGLM={config.showGLM} />}
        </div>
      </div>

      {showFooter && (
        <footer className="border-t border-gray-100 bg-white py-4 px-4">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            {config.showVersion && (
              <span className="text-gray-500 text-sm">版本 {pkg.version}</span>
            )}
            {config.showLicense && <LicenseButton />}
          </div>
        </footer>
      )}
    </div>
  );
}
