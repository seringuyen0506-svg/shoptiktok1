/**
 * Frontend Example: Sequential Crawl Usage
 * 
 * Cách sử dụng tính năng crawl tuần tự từ frontend
 */

// Example 1: Basic Sequential Crawl
async function crawlMultipleLinks() {
  const links = [
    'https://www.tiktok.com/@shop1/video/123',
    'https://www.tiktok.com/@shop2/video/456',
    'https://www.tiktok.com/@shop3/video/789'
  ];
  
  try {
    console.log('🚀 Starting sequential crawl...');
    
    const response = await fetch('http://localhost:5000/api/crawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        links: links,
        note: 'Sequential crawl test'
      })
    });
    
    const data = await response.json();
    
    console.log('✅ Crawl completed!');
    console.log(`📊 Results: ${data.results.length} items`);
    console.log(`💬 Message: ${data.message}`);
    
    // Display results
    data.results.forEach((result, index) => {
      console.log(`\nLink ${index + 1}:`);
      console.log(`  URL: ${result.url}`);
      console.log(`  Shop: ${result.shopName}`);
      console.log(`  Product: ${result.productName}`);
      console.log(`  Status: ${result.status}`);
    });
    
    // ⚠️ Important: Browser is still open!
    alert('Crawling complete! Browser window is still open - close it manually when done.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    alert('Error during crawl: ' + error.message);
  }
}

// Example 2: With Progress Updates (if using async endpoint)
async function crawlWithProgressTracking() {
  const links = ['url1', 'url2', 'url3', 'url4', 'url5'];
  
  try {
    // Start async crawl
    const startResponse = await fetch('http://localhost:5000/api/crawl-async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links })
    });
    
    const { jobId } = await startResponse.json();
    console.log(`📋 Job started: ${jobId}`);
    
    // Poll for progress
    const pollInterval = setInterval(async () => {
      const statusResponse = await fetch(`http://localhost:5000/api/crawl-async/${jobId}`);
      const job = await statusResponse.json();
      
      console.log(`⏳ Progress: ${job.completed}/${job.total} (${job.status})`);
      
      if (job.status === 'done' || job.status === 'error') {
        clearInterval(pollInterval);
        console.log('✅ Crawl finished!');
        console.log(`📊 Results: ${job.results.length} items`);
        
        // Browser is still open!
        alert('Crawling complete! Browser window is still open - close it manually.');
      }
    }, 2000); // Check every 2 seconds
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Example 3: HTML Button Integration
document.getElementById('crawlButton')?.addEventListener('click', async () => {
  const button = document.getElementById('crawlButton');
  const linksTextarea = document.getElementById('linksInput');
  const resultsDiv = document.getElementById('results');
  
  // Get links from textarea (one per line)
  const links = linksTextarea.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
  
  if (links.length === 0) {
    alert('Please enter at least one link!');
    return;
  }
  
  // Disable button during crawl
  button.disabled = true;
  button.textContent = `Crawling ${links.length} links...`;
  resultsDiv.innerHTML = '<p>⏳ Crawling in progress...</p>';
  
  try {
    const response = await fetch('http://localhost:5000/api/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links, note: 'User crawl request' })
    });
    
    const data = await response.json();
    
    // Show results
    resultsDiv.innerHTML = `
      <h3>✅ Crawl Complete!</h3>
      <p><strong>Total Links:</strong> ${data.results.length}</p>
      <p><strong>Message:</strong> ${data.message}</p>
      <hr>
      <h4>Results:</h4>
      <ul>
        ${data.results.map((r, i) => `
          <li>
            <strong>Link ${i + 1}:</strong><br>
            Shop: ${r.shopName || 'N/A'}<br>
            Product: ${r.productName || 'N/A'}<br>
            Status: ${r.status || 'unknown'}
          </li>
        `).join('')}
      </ul>
    `;
    
    // Important reminder
    if (data.message.includes('remains open')) {
      resultsDiv.innerHTML += `
        <div style="background: #fff3cd; padding: 10px; margin-top: 10px; border-radius: 5px;">
          ⚠️ <strong>Important:</strong> Browser window is still open. 
          Close it manually when you're done reviewing.
        </div>
      `;
    }
    
  } catch (error) {
    resultsDiv.innerHTML = `<p style="color: red;">❌ Error: ${error.message}</p>`;
  } finally {
    button.disabled = false;
    button.textContent = 'Start Crawling';
  }
});

// Example 4: React Component
function SequentialCrawler() {
  const [links, setLinks] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  
  const handleCrawl = async () => {
    const linkArray = links.split('\n').map(l => l.trim()).filter(l => l);
    
    if (linkArray.length === 0) {
      alert('Please enter at least one link!');
      return;
    }
    
    setLoading(true);
    setResults([]);
    setMessage('');
    
    try {
      const response = await fetch('http://localhost:5000/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: linkArray })
      });
      
      const data = await response.json();
      setResults(data.results);
      setMessage(data.message);
      
    } catch (error) {
      setMessage('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <h2>Sequential Crawler</h2>
      
      <textarea
        value={links}
        onChange={(e) => setLinks(e.target.value)}
        placeholder="Enter links (one per line)"
        rows={10}
        style={{ width: '100%' }}
      />
      
      <button onClick={handleCrawl} disabled={loading}>
        {loading ? `Crawling...` : 'Start Crawling'}
      </button>
      
      {message && (
        <div className="message">
          {message}
        </div>
      )}
      
      {results.length > 0 && (
        <div className="results">
          <h3>Results ({results.length})</h3>
          {results.map((result, i) => (
            <div key={i} className="result-item">
              <strong>Link {i + 1}:</strong><br />
              Shop: {result.shopName}<br />
              Product: {result.productName}<br />
              Status: {result.status}
            </div>
          ))}
        </div>
      )}
      
      {message.includes('remains open') && (
        <div className="warning">
          ⚠️ Browser window is still open - close it manually when done!
        </div>
      )}
    </div>
  );
}

/*
HTML Example:

<!DOCTYPE html>
<html>
<head>
  <title>Sequential Crawler</title>
</head>
<body>
  <h1>TikTok Shop Sequential Crawler</h1>
  
  <div>
    <label>Links (one per line):</label><br>
    <textarea id="linksInput" rows="10" cols="60"></textarea>
  </div>
  
  <button id="crawlButton">Start Crawling</button>
  
  <div id="results"></div>
  
  <script src="frontend-example.js"></script>
</body>
</html>
*/
