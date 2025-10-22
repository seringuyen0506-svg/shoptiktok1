// Quick test to verify analyze-growth response structure
import axios from 'axios';

async function testAnalyzeAPI() {
  try {
    console.log('🧪 Testing /api/analyze-growth with real data...\n');
    
    const response = await axios.post('http://localhost:5000/api/analyze-growth', {
      shopName: 'BullockXp819',
      deepseekApiKey: 'sk-test-dummy-key'
    }, {
      timeout: 60000
    });
    
    console.log('✅ Status:', response.status);
    console.log('✅ Success:', response.data.success);
    console.log('\n📊 Response structure:');
    console.log('- shopInfo:', response.data.shopInfo ? 'EXISTS' : 'NULL');
    console.log('- topProducts:', response.data.topProducts?.length || 0, 'items');
    console.log('- aiAnalysis:', response.data.aiAnalysis ? `${response.data.aiAnalysis.length} chars` : 'NULL');
    console.log('- dataPoints:', response.data.dataPoints);
    
    if (response.data.topProducts && response.data.topProducts.length > 0) {
      console.log('\n🔥 First product sample:');
      console.log(JSON.stringify(response.data.topProducts[0], null, 2));
    }
    
    if (response.data.aiAnalysis) {
      console.log('\n💬 AI Analysis preview:');
      console.log(response.data.aiAnalysis.substring(0, 200) + '...');
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

testAnalyzeAPI();
