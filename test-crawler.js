// Test script để kiểm tra crawler
import('../backend/node_modules/axios/index.js').then(({ default: axios }) => {

const testUrl = 'https://vt.tiktok.com/ZSjq4LWQG/'; // Link test TikTok
const testProxy = '43.159.20.117:12233:user-ZP85NKvw-region-us-sessid-UUo9s9kd-sesstime-1:SgcjjxXh';

async function testCrawl() {
  console.log('🧪 Testing TikTok crawler...\n');
  
  try {
    console.log('📡 Sending request to backend...');
    const response = await axios.post('http://localhost:5000/api/crawl', {
      links: [testUrl],
      proxy: testProxy,
      apiKey: '' // Để trống nếu không có
    });
    
    console.log('\n✅ Response received:');
    console.log(JSON.stringify(response.data, null, 2));
    
    const result = response.data.results[0];
    if (result.status === 'success') {
      console.log('\n🎉 SUCCESS! Data extracted:');
      console.log('  - Shop Name:', result.shopName);
      console.log('  - Shop Sold:', result.shopSold);
      console.log('  - Product Name:', result.productName);
      console.log('  - Product Sold:', result.productSold);
    } else if (result.status === 'captcha_detected') {
      console.log('\n⚠️  Captcha detected - need API key to solve');
    } else {
      console.log('\n❌ Failed:', result.status);
      console.log('  Error:', result.error || result.message);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Chạy test
testCrawl();

});
