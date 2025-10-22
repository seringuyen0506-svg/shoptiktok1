// Test Shop Crawl API with real scrapecreators.com
import axios from 'axios';

async function testShopCrawl() {
  try {
    console.log('🧪 Testing /api/crawl-shop endpoint...\n');
    
    // Replace with your actual API key
    const API_KEY = 'YOUR_SCRAPECREATORS_API_KEY';
    const SHOP_URL = 'https://www.tiktok.com/@golinutrition';
    
    if (API_KEY === 'YOUR_SCRAPECREATORS_API_KEY') {
      console.log('⚠️  Please set your scrapecreators.com API key in the script!');
      console.log('   Get one at: https://scrapecreators.com');
      return;
    }
    
    console.log(`📡 Sending request to backend...`);
    console.log(`   Shop URL: ${SHOP_URL}`);
    console.log(`   Amount: 5 products (test)`);
    
    const response = await axios.post('http://localhost:5000/api/crawl-shop', {
      shopUrl: SHOP_URL,
      amount: 5,
      apiKey: API_KEY,
      note: 'Test crawl from script'
    }, {
      timeout: 120000
    });
    
    console.log('\n✅ Response received!');
    console.log('Status:', response.status);
    console.log('\n📊 Shop Info:');
    console.log(JSON.stringify(response.data.shopInfo, null, 2));
    console.log(`\n📦 Total products saved: ${response.data.totalSaved}`);
    
    if (response.data.products && response.data.products.length > 0) {
      console.log('\n🔥 First product sample:');
      console.log('- Name:', response.data.products[0].productName);
      console.log('- Price:', response.data.products[0].price);
      console.log('- Sold:', response.data.products[0].productSold);
      console.log('- Shop Sold:', response.data.products[0].shopSold);
      console.log('- Rating:', response.data.products[0].rating);
      console.log('- URL:', response.data.products[0].url);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed!');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testShopCrawl();
