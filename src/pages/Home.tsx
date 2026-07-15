import { SearchBar } from '../components/SearchBar';
import { SearchResults } from '../components/SearchResults';

export default function Home() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <SearchBar />
        <SearchResults />
      </div>
    </div>
  );
}