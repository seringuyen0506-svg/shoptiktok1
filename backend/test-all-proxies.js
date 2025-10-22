/**
 * Test All Proxies - Find Best Working Proxy
 * Tests connection, speed, and TikTok access
 */

import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const PROXIES = [
  '142.111.48.253:7030:rmlkbbjk:e3s8ms72yxir',
  '31.59.20.176:6754:rmlkbbjk:e3s8ms72yxir',
  '38.170.176.177:5572:rmlkbbjk:e3s8ms72yxir',
  '198.23.239.134:6540:rmlkbbjk:e3s8ms72yxir',
  '45.38.107.97:6014:rmlkbbjk:e3s8ms72yxir',
  '107.172.163.27:6543:rmlkbbjk:e3s8ms72yxir',
  '64.137.96.74:6641:rmlkbbjk:e3s8ms72yxir',
  '216.10.27.159:6837:rmlkbbjk:e3s8ms72yxir',
  '142.111.67.146:5611:rmlkbbjk:e3s8ms72yxir',
  '142.147.128.93:6593:rmlkbbjk:e3s8ms72yxir'
];

function parseProxy(proxyStr) {
  const parts = proxyStr.split(':');
  return {
    host: parts[0],
    port: parseInt(parts[1]),
    username: parts[2],
    password: parts[3],
    raw: proxyStr
  };
}

function buildProxyAgent(config) {
  const auth = `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}`;
  const proxyUrl = `http://${auth}@${config.host}:${config.port}`;
  return new HttpsProxyAgent(proxyUrl, {
    rejectUnauthorized: false
  });
}

async function testProxy(proxyStr, index) {
  const config = parseProxy(proxyStr);
  const result = {
    index: index + 1,
    proxy: `${config.host}:${config.port}`,
    ip: null,
    speedMs: null,
    tiktokStatus: null,
    working: false,
    error: null
  };

  console.log(`\n[${ index + 1}/10] Testing ${config.host}:${config.port}...`);

  try {
    const agent = buildProxyAgent(config);
    
    // Test 1: Check IP & Speed
    const startTime = Date.now();
    const ipResponse = await axios.get('https://api.ipify.org?format=json', {
      httpsAgent: agent,
      timeout: 15000
    });
    const responseTime = Date.now() - startTime;
    
    result.ip = ipResponse.data.ip;
    result.speedMs = responseTime;
    
    console.log(`   ✅ IP: ${result.ip}`);
    console.log(`   ⚡ Speed: ${responseTime}ms`);
    
    // Test 2: TikTok Access
    const tiktokResponse = await axios.get('https://www.tiktok.com', {
      httpsAgent: agent,
      timeout: 15000,
      validateStatus: () => true
    });
    
    result.tiktokStatus = tiktokResponse.status;
    console.log(`   🎵 TikTok: ${tiktokResponse.status}`);
    
    if (tiktokResponse.status === 407) {
      result.error = 'Proxy authentication failed (407)';
      console.log(`   ❌ ${result.error}`);
    } else if (tiktokResponse.status === 200 || tiktokResponse.status === 307) {
      result.working = true;
      console.log(`   ✅ WORKING!`);
    } else {
      result.error = `Unexpected status: ${tiktokResponse.status}`;
      console.log(`   ⚠️  ${result.error}`);
    }
    
  } catch (error) {
    result.error = error.message;
    console.log(`   ❌ FAILED: ${error.message}`);
  }
  
  return result;
}

async function testAllProxies() {
  console.log('='.repeat(70));
  console.log('🔍 Testing All 10 Proxies');
  console.log('='.repeat(70));
  
  const results = [];
  
  for (let i = 0; i < PROXIES.length; i++) {
    const result = await testProxy(PROXIES[i], i);
    results.push(result);
    
    // Wait between tests to avoid rate limiting
    if (i < PROXIES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  
  const working = results.filter(r => r.working);
  const failed = results.filter(r => !r.working);
  
  console.log(`\n✅ Working Proxies: ${working.length}/10`);
  console.log(`❌ Failed Proxies: ${failed.length}/10`);
  
  if (working.length > 0) {
    console.log('\n🏆 WORKING PROXIES (sorted by speed):');
    console.log('-'.repeat(70));
    
    working.sort((a, b) => a.speedMs - b.speedMs);
    
    working.forEach((r, i) => {
      console.log(`${i + 1}. Proxy #${r.index}: ${r.proxy}`);
      console.log(`   IP: ${r.ip} | Speed: ${r.speedMs}ms | TikTok: ${r.tiktokStatus}`);
      console.log(`   Raw: ${PROXIES[r.index - 1]}`);
    });
    
    console.log('\n💡 RECOMMENDED (fastest):');
    console.log(`   ${PROXIES[working[0].index - 1]}`);
    console.log('\n📝 Update crawl-workflow-correct.js line 22:');
    console.log(`   const PROXY_STRING = '${PROXIES[working[0].index - 1]}';`);
  }
  
  if (failed.length > 0) {
    console.log('\n❌ FAILED PROXIES:');
    console.log('-'.repeat(70));
    
    failed.forEach(r => {
      console.log(`Proxy #${r.index}: ${r.proxy}`);
      console.log(`   Error: ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
}

testAllProxies().catch(console.error);
