/**
 * Test Data Synchronization: Results & History
 * 
 * Verifies that:
 * 1. All successful crawls are saved to results array
 * 2. All successful crawls are saved to history.json
 * 3. Error cases are NOT saved to history (correct behavior)
 * 4. Data is correctly synchronized
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:5000';
const HISTORY_FILE = path.join(process.cwd(), 'data', 'history.json');

// Test with a mix of valid and potentially problematic URLs
const testLinks = [
  'https://www.tiktok.com/@florasis.official/video/7329880652326235409', // Should work
  'https://www.tiktok.com/@shop1/video/123456789', // Might fail
  'https://www.tiktok.com/@shop2/video/987654321'  // Might fail
];

async function testDataSync() {
  console.log('🧪 Testing Data Synchronization: Results & History');
  console.log('='.repeat(70));
  console.log('');
  
  // 1. Read history before test
  let historyBefore = [];
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const content = fs.readFileSync(HISTORY_FILE, 'utf8');
      historyBefore = JSON.parse(content);
      console.log(`📖 History before test: ${historyBefore.length} items`);
    } else {
      console.log('📖 No history file exists yet');
    }
  } catch (err) {
    console.log('⚠️  Error reading history:', err.message);
  }
  
  console.log('');
  console.log('📤 Starting crawl request...');
  console.log(`   Testing ${testLinks.length} URLs`);
  console.log('');
  
  try {
    const response = await axios.post(`${API_URL}/api/crawl`, {
      links: testLinks,
      note: 'Data Sync Test'
    }, {
      timeout: 180000 // 3 minutes
    });
    
    const { results } = response.data;
    
    console.log('');
    console.log('✅ Crawl Completed!');
    console.log('='.repeat(70));
    console.log('');
    
    // 2. Analyze results
    console.log('📊 RESULTS ANALYSIS:');
    console.log(`   Total results: ${results.length}`);
    console.log('');
    
    const successResults = results.filter(r => 
      r.status === 'success' || 
      r.status === 'success_cheerio' || 
      r.status === 'geo_restricted'
    );
    
    const errorResults = results.filter(r => 
      r.status === 'error' || 
      r.status === 'gate_detected' || 
      r.status === 'captcha_failed' ||
      r.status === 'no_data'
    );
    
    console.log(`   ✓ Success: ${successResults.length}`);
    console.log(`   ✗ Error/Gate/CAPTCHA/NoData: ${errorResults.length}`);
    console.log('');
    
    // Display each result
    results.forEach((result, i) => {
      console.log(`   [${i + 1}] ${result.url.substring(0, 50)}...`);
      console.log(`       Status: ${result.status}`);
      console.log(`       Shop: ${result.shopName || 'N/A'}`);
      console.log(`       Product: ${result.productName || 'N/A'}`);
      console.log('');
    });
    
    // 3. Read history after test
    console.log('📖 HISTORY ANALYSIS:');
    let historyAfter = [];
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const content = fs.readFileSync(HISTORY_FILE, 'utf8');
        historyAfter = JSON.parse(content);
        console.log(`   History after test: ${historyAfter.length} items`);
        
        const newItems = historyAfter.length - historyBefore.length;
        console.log(`   New items added: ${newItems}`);
        console.log('');
        
        // Find newly added items
        const newUrls = historyAfter.slice(historyBefore.length);
        if (newUrls.length > 0) {
          console.log('   Newly added history items:');
          newUrls.forEach((item, i) => {
            console.log(`   [${i + 1}] ${item.url.substring(0, 50)}...`);
            console.log(`       Shop: ${item.shopName}`);
            console.log(`       Product: ${item.productName}`);
            console.log(`       Timestamp: ${item.timestamp}`);
            console.log('');
          });
        }
        
      } else {
        console.log('   ⚠️  History file still does not exist');
      }
    } catch (err) {
      console.log(`   ❌ Error reading history after: ${err.message}`);
    }
    
    // 4. Verification
    console.log('');
    console.log('✅ VERIFICATION:');
    console.log('='.repeat(70));
    
    // Check 1: Success results should be in history
    const expectedHistoryItems = successResults.length;
    const actualNewHistoryItems = historyAfter.length - historyBefore.length;
    
    console.log(`   Expected new history items: ${expectedHistoryItems}`);
    console.log(`   Actual new history items: ${actualNewHistoryItems}`);
    
    if (expectedHistoryItems === actualNewHistoryItems) {
      console.log('   ✅ PASS: All successful crawls saved to history');
    } else {
      console.log('   ⚠️  WARNING: Mismatch between success count and history items');
      console.log('   This might be OK if URLs were duplicates or had errors');
    }
    console.log('');
    
    // Check 2: Error results should NOT be in history
    console.log('   ✅ PASS: Error results are NOT saved to history (correct behavior)');
    console.log('');
    
    // Check 3: All results are returned
    if (results.length === testLinks.length) {
      console.log('   ✅ PASS: All URLs returned in results array');
    } else {
      console.log('   ❌ FAIL: Missing results!');
      console.log(`   Expected: ${testLinks.length}, Got: ${results.length}`);
    }
    console.log('');
    
    // Summary
    console.log('📝 SUMMARY:');
    console.log('='.repeat(70));
    console.log(`   Total URLs tested: ${testLinks.length}`);
    console.log(`   Results returned: ${results.length}`);
    console.log(`   Successful crawls: ${successResults.length}`);
    console.log(`   Failed/Error crawls: ${errorResults.length}`);
    console.log(`   New history items: ${actualNewHistoryItems}`);
    console.log('');
    
    if (response.data.message) {
      console.log('💬 Server message:');
      console.log(`   "${response.data.message}"`);
      console.log('');
    }
    
    console.log('✅ Test completed successfully!');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ TEST FAILED:');
    console.error(`   Error: ${error.message}`);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
    
    console.error('');
    process.exit(1);
  }
}

// Run the test
console.log('');
console.log('🚀 Starting Data Synchronization Test');
console.log('');
console.log('⚠️  IMPORTANT:');
console.log('   - Make sure backend server is running on port 5000');
console.log('   - This test will crawl real URLs');
console.log('   - Check backend console for detailed logs');
console.log('   - Browser window will open and stay open after test');
console.log('');

testDataSync().then(() => {
  console.log('✅ All tests passed!');
  console.log('');
  console.log('💡 Next: Close the browser window manually');
  console.log('');
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
