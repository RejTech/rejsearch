import { SearchBar } from '../components/SearchBar';
import { SearchResults } from '../components/SearchResults';
import { LicenseButton } from '../components/LicenseButton';
import pkg from '../../package.json';

export default function Ask() {
  return (
    <div className="min-h-screen flex flex-col">
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

      <footer className="border-t border-gray-100 bg-white py-4 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-gray-500 text-sm">版本 {pkg.version}</span>
          <LicenseButton />
        </div>
      </footer>
    </div>
  );
}
