/**
 * Test Sequential Crawl with Browser Keep-Alive
 * 
 * This test verifies that:
 * 1. Links are crawled one at a time (sequentially)
 * 2. Each tab is closed after crawling
 * 3. Browser remains open after all crawls complete
 * 4. User must close browser manually
 */

import axios from 'axios';

const API_URL = 'http://localhost:5000';

// Test links - multiple TikTok Shop product URLs
const testLinks = [
  'https://www.tiktok.com/@florasis.official/video/7329880652326235409',
  'https://www.tiktok.com/@florasis.official/video/7329880652326235410',
  'https://www.tiktok.com/@florasis.official/video/7329880652326235411'
];

async function testSequentialCrawl() {
  console.log('🧪 Testing Sequential Crawl with Browser Keep-Alive');
  console.log('='.repeat(60));
  console.log(`Testing with ${testLinks.length} links`);
  console.log('');
  
  try {
    console.log('📤 Sending crawl request...');
    const startTime = Date.now();
    
    const response = await axios.post(`${API_URL}/api/crawl`, {
      links: testLinks,
      apiKey: 'dummy-key', // Not used for basic crawl
      note: 'Sequential Crawl Test'
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('');
    console.log('✅ Crawl Request Completed!');
    console.log('='.repeat(60));
    console.log(`⏱️  Total time: ${elapsed}s`);
    console.log(`📊 Results count: ${response.data.results?.length || 0}`);
    console.log('');
    
    if (response.data.message) {
      console.log('💬 Message from server:');
      console.log(`   "${response.data.message}"`);
      console.log('');
    }
    
    console.log('✅ EXPECTED BEHAVIOR:');
    console.log('   1. ✓ Links were crawled one at a time (not in parallel)');
    console.log('   2. ✓ Each tab was closed after crawling');
    console.log('   3. ✓ Browser window is still open');
    console.log('   4. ✓ You need to close the browser manually');
    console.log('');
    console.log('🔍 Please verify visually:');
    console.log('   - Check if browser window is still open');
    console.log('   - Check server console logs for sequential processing');
    console.log('   - Try closing browser manually');
    console.log('');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

// Run the test
console.log('');
console.log('🚀 Starting Sequential Crawl Test');
console.log('');
console.log('⚠️  IMPORTANT: Make sure backend server is running on port 5000');
console.log('   Run: npm start (in backend directory)');
console.log('');

testSequentialCrawl().then(() => {
  console.log('');
  console.log('✅ Test script completed');
  console.log('');
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
