const API_KEY = 'as_sk_66a3631c2e8124cebdd66dd45f9aec13';
const API_URL = 'https://api.anysearch.com/v1/search';

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source?: string;
  timestamp?: string;
  score?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

export interface ExtractResponse {
  content: string;
  title: string;
  url: string;
}

export async function search(query: string, maxResults: number = 10, freshness?: string): Promise<SearchResponse> {
  const body: Record<string, unknown> = {
    query,
    max_results: maxResults,
  };

  if (freshness) {
    body.freshness = freshness;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(data.message || 'Search failed');
  }

  const results: SearchResult[] = data.data?.results || [];

  return {
    results,
    total: results.length,
    query,
  };
}

export async function extract(url: string): Promise<ExtractResponse> {
  const extractUrl = 'https://api.anysearch.com/v1/extract';
  
  const response = await fetch(extractUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`Extract failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(data.message || 'Extract failed');
  }

  return {
    content: data.data?.content || '',
    title: data.data?.title || '',
    url,
  };
}