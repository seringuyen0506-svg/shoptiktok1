// Test analyze-growth API endpoint
import axios from 'axios';

async function testAnalyze() {
  try {
    console.log('🧪 Testing /api/analyze-growth endpoint...');
    
    const response = await axios.post('http://localhost:8080/api/analyze-growth', {
      shopName: 'BullockXp819',
      deepseekApiKey: 'sk-test-fake-key-for-testing'
    }, {
      timeout: 5000
    });
    
    console.log('✅ Response status:', response.status);
    console.log('✅ Response data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed!');
    console.error('❌ Error message:', error.message);
    
    if (error.response) {
      console.error('❌ Response status:', error.response.status);
      console.error('❌ Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to server. Is backend running?');
    }
  }
}

testAnalyze();
