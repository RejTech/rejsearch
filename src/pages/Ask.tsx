import { SearchBar } from '../components/SearchBar';
import { SearchResults } from '../components/SearchResults';
import { LicenseButton } from '../components/LicenseButton';
import { ThemeToggle } from '../components/ThemeToggle';
import pkg from '../../package.json';

export default function Ask() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 transition-colors">
      <div className="flex-1 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <SearchBar
            showTitle={false}
            showAdvancedSearch={true}
            showGLM={true}
            autoSearchParam="s"
          />
          <SearchResults showGLM={true} />
        </div>
      </div>

      <footer className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-4 px-4 transition-colors">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 dark:text-gray-400 text-sm">版本 {pkg.version}</span>
            <ThemeToggle />
          </div>
          <LicenseButton />
        </div>
      </footer>
    </div>
  );
}
