import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

async function testEndpoints() {
  console.log('🧪 Testing Backend API Endpoints\n');
  console.log('='.repeat(60));
  
  // Test 1: Health check
  console.log('\n1️⃣ Testing /health');
  try {
    const r = await axios.get(`${BASE_URL}/health`);
    console.log(`✅ Status: ${r.status} - ${r.data}`);
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }
  
  // Test 2: API Health
  console.log('\n2️⃣ Testing /api/health');
  try {
    const r = await axios.get(`${BASE_URL}/api/health`);
    console.log(`✅ Status: ${r.status}`);
    console.log(`   Service: ${r.data.service}`);
    console.log(`   Timestamp: ${r.data.timestamp}`);
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }
  
  // Test 3: Get history
  console.log('\n3️⃣ Testing GET /api/history');
  try {
    const r = await axios.get(`${BASE_URL}/api/history`);
    console.log(`✅ Status: ${r.status}`);
    console.log(`   Items: ${r.data.items?.length || 0}`);
    if (r.data.items && r.data.items.length > 0) {
      console.log(`   Last product: ${r.data.items[0].productName}`);
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }
  
  // Test 4: Crawl endpoint (will fail but check validation)
  console.log('\n4️⃣ Testing POST /api/crawl (validation)');
  try {
    const r = await axios.post(`${BASE_URL}/api/crawl`, {
      productUrl: 'invalid-url',
      note: 'test'
    }, { validateStatus: () => true });
    console.log(`   Status: ${r.status}`);
    if (r.status !== 200) {
      console.log(`✅ Validation working: ${r.data.error || r.data.message}`);
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }
  
  // Test 5: Shop crawl validation
  console.log('\n5️⃣ Testing POST /api/crawl-shop (validation)');
  try {
    const r = await axios.post(`${BASE_URL}/api/crawl-shop`, {
      shopUrl: 'https://www.tiktok.com/@test',
      apiKey: 'test'
    }, { validateStatus: () => true });
    console.log(`   Status: ${r.status}`);
    if (r.status !== 200) {
      console.log(`✅ Validation working: ${r.data.error || r.data.hint}`);
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }
  
  // Test 6: Analyze growth validation
  console.log('\n6️⃣ Testing POST /api/analyze-growth (validation)');
  try {
    const r = await axios.post(`${BASE_URL}/api/analyze-growth`, {
      productIds: [],
      apiKey: 'test'
    }, { validateStatus: () => true });
    console.log(`   Status: ${r.status}`);
    if (r.status !== 200) {
      console.log(`✅ Validation working: ${r.data.error}`);
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Backend API test complete!\n');
}

testEndpoints().catch(console.error);
