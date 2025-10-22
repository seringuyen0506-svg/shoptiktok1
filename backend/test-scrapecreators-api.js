import axios from 'axios';

const API_KEY = 'sFEz5epnxPdedK7Mv3yAL7FpKvRCY2sW'; // Thay bằng API key của bạn

async function testAPI(urlParam, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${description}`);
  console.log(`URL parameter: ${urlParam}`);
  console.log('='.repeat(60));
  
  try {
    const response = await axios.get('https://api.scrapecreators.com/v1/tiktok/shop/products', {
      headers: {
        'x-api-key': API_KEY
      },
      params: {
        url: urlParam
      },
      validateStatus: (status) => status < 600
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`Credits remaining: ${response.data.credits_remaining || 'N/A'}`);
    
    if (response.status === 200 && response.data.success) {
      console.log(`Shop: ${response.data.shopInfo?.shop_name || 'N/A'}`);
      console.log(`Products: ${response.data.products?.length || 0}`);
      console.log(`Sold: ${response.data.shopInfo?.format_sold_count || 'N/A'}`);
    } else {
      console.log(`❌ Error: ${response.data.error || 'Unknown'}`);
      console.log(`Message: ${response.data.message || 'N/A'}`);
    }
    
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Data:`, error.response.data);
    }
  }
}

async function main() {
  console.log('\n🧪 ScapeCreators API Test Suite\n');
  console.log(`API Key: ${API_KEY.substring(0, 10)}...`);
  
  // Test 1: Full URL with /shop/store/ format
  await testAPI(
    'https://www.tiktok.com/shop/store/donald-tretasco-llc/7495975775290100106',
    'Full URL - /shop/store/ format'
  );
  
  // Test 2: Shop ID only
  await testAPI(
    '7495975775290100106',
    'Shop ID only'
  );
  
  // Test 3: Known working shop (Goli Nutrition from reference)
  await testAPI(
    'https://www.tiktok.com/@golinutrition',
    '@username format (known shop)'
  );
  
  // Test 4: Shop ID from known shop
  await testAPI(
    '7495794203056835079',
    'Shop ID - Goli Nutrition'
  );
  
  // Test 5: Without any params (check if API key specific)
  console.log(`\n${'='.repeat(60)}`);
  console.log('Testing: No URL parameter (API key default)');
  console.log('='.repeat(60));
  try {
    const response = await axios.get('https://api.scrapecreators.com/v1/tiktok/shop/products', {
      headers: {
        'x-api-key': API_KEY
      },
      validateStatus: (status) => status < 600
    });
    console.log(`✅ Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.data, null, 2).substring(0, 500));
  } catch (error) {
    console.log(`❌ Error: ${error.response?.data?.message || error.message}`);
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('Test complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
