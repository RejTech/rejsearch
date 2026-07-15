const API_KEY = 'as_sk_66a3631c2e8124cebdd66dd45f9aec13';

async function testDifferentEndpoints() {
  const endpoints = [
    'https://api.anysearch.com/mcp',
    'https://api.anysearch.com/api/search',
    'https://api.anysearch.com/v1/search',
    'https://api.anysearch.com/search',
  ];

  for (const url of endpoints) {
    console.log(`\n=== Testing endpoint: ${url} ===`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ query: 'test', max_results: 3 }),
      });
      
      console.log('Status:', response.status);
      const text = await response.text();
      console.log('Response:', text.substring(0, 500));
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

async function testJsonRpcMethods() {
  const url = 'https://api.anysearch.com/mcp';
  const methods = [
    { method: 'call', params: { name: 'search', arguments: { query: 'test', max_results: 3 } } },
    { method: 'invoke', params: { function: 'search', args: { query: 'test', max_results: 3 } } },
    { method: 'execute', params: { command: 'search', options: { query: 'test', max_results: 3 } } },
    { method: 'list', params: {} },
    { method: 'describe', params: {} },
    { method: 'info', params: {} },
  ];

  for (const { method, params } of methods) {
    console.log(`\n=== Testing method: ${method} ===`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: 1,
        }),
      });
      
      const text = await response.text();
      console.log('Response:', text.substring(0, 500));
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

testDifferentEndpoints().then(() => testJsonRpcMethods());