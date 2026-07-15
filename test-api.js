const API_KEY = 'as_sk_66a3631c2e8124cebdd66dd45f9aec13';

async function testEndpoints() {
  const endpoints = [
    'https://api.anysearch.com/v1/search',
    'https://api.anysearch.com/v1/extract',
    'https://api.anysearch.com/v1/fetch',
    'https://api.anysearch.com/v1/query',
    'https://api.anysearch.com/v1/content',
    'https://api.anysearch.com/api/extract',
    'https://api.anysearch.com/api/fetch',
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
        body: JSON.stringify({ url: 'https://www.example.com' }),
      });
      
      console.log('Status:', response.status);
      const text = await response.text();
      console.log('Response:', text.substring(0, 300));
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

async function testSearchWithMoreParams() {
  console.log('\n=== Testing search with extract param ===');
  
  try {
    const response = await fetch('https://api.anysearch.com/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ 
        query: 'AI Agent', 
        max_results: 3,
        extract_content: true
      }),
    });
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    if (data.data?.results && data.data.results[0]) {
      console.log('\nFirst result keys:', Object.keys(data.data.results[0]));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

testEndpoints().then(() => testSearchWithMoreParams());