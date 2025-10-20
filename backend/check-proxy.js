import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const CONFIG = {
  proxy: {
    host: 'p.webshare.io',
    port: '80',
    username: 'ppuozozl-rotate',
    password: 'c8iqnclktjv9'
  }
};

async function checkProxyType() {
  console.log('\n🔍 PROXY TYPE CHECKER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const proxyUrl = `http://${CONFIG.proxy.username}:${CONFIG.proxy.password}@${CONFIG.proxy.host}:${CONFIG.proxy.port}`;
  
  console.log('📡 Testing proxy...\n');
  
  try {
    // Test 1: Basic IP info
    const ipInfo = await axios.get('https://ipinfo.io/json', {
      httpsAgent: new HttpsProxyAgent(proxyUrl),
      timeout: 15000,
      validateStatus: () => true
    });
    
    if (ipInfo.status !== 200) {
      throw new Error(`Proxy returned status ${ipInfo.status}`);
    }
    
    console.log('✅ Proxy Connection: SUCCESS\n');
    console.log('📍 IP Information:');
    console.log(`   IP Address: ${ipInfo.data.ip || 'N/A'}`);
    console.log(`   Location: ${ipInfo.data.city || 'N/A'}, ${ipInfo.data.region || 'N/A'}, ${ipInfo.data.country || 'N/A'}`);
    console.log(`   ISP/Org: ${ipInfo.data.org || 'N/A'}`);
    console.log(`   Timezone: ${ipInfo.data.timezone || 'N/A'}`);
    console.log(`   Postal: ${ipInfo.data.postal || 'N/A'}\n`);
    
    // Test 2: Detect proxy type
    const org = (ipInfo.data.org || '').toLowerCase();
    const hostname = ipInfo.data.hostname || '';
    
    const datacenterKeywords = [
      'digitalocean', 'amazon', 'aws', 'google cloud', 'gcp', 'azure',
      'ovh', 'linode', 'vultr', 'hetzner', 'contabo', 'server',
      'hosting', 'datacenter', 'data center', 'cloud', 'webshare'
    ];
    
    const residentialKeywords = [
      'comcast', 'verizon', 'at&t', 'att', 'charter', 'spectrum',
      'cox', 'time warner', 'cable', 'broadband', 'telecom',
      'internet service', 'isp', 'residential'
    ];
    
    const mobileKeywords = [
      'mobile', 'wireless', 'cellular', 't-mobile', 'sprint',
      'vodafone', 'orange', 'telefonica', '4g', '5g', 'lte'
    ];
    
    let proxyType = 'UNKNOWN';
    let isDatacenter = false;
    let isResidential = false;
    let isMobile = false;
    
    // Check datacenter
    for (const keyword of datacenterKeywords) {
      if (org.includes(keyword) || hostname.toLowerCase().includes(keyword)) {
        isDatacenter = true;
        break;
      }
    }
    
    // Check residential
    for (const keyword of residentialKeywords) {
      if (org.includes(keyword)) {
        isResidential = true;
        break;
      }
    }
    
    // Check mobile
    for (const keyword of mobileKeywords) {
      if (org.includes(keyword)) {
        isMobile = true;
        break;
      }
    }
    
    if (isMobile) {
      proxyType = 'MOBILE';
    } else if (isResidential) {
      proxyType = 'RESIDENTIAL';
    } else if (isDatacenter) {
      proxyType = 'DATACENTER';
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🏷️  PROXY TYPE ANALYSIS\n');
    console.log(`   Type: ${proxyType}\n`);
    
    if (proxyType === 'DATACENTER') {
      console.log('❌ DATACENTER PROXY DETECTED!\n');
      console.log('⚠️  TikTok Compatibility: POOR');
      console.log('   - TikTok will likely detect and block this proxy');
      console.log('   - Expected error: error_code 23002102 (geo-restriction)');
      console.log('   - Success rate: <10%\n');
      console.log('💡 RECOMMENDATION: Switch to Residential or Mobile proxy\n');
      console.log('   Recommended Providers:');
      console.log('   1. Bright Data (Premium) - https://brightdata.com');
      console.log('   2. Smartproxy (Mid-range) - https://smartproxy.com');
      console.log('   3. Proxy-Cheap (Budget) - https://proxy-cheap.com\n');
    } else if (proxyType === 'RESIDENTIAL') {
      console.log('✅ RESIDENTIAL PROXY DETECTED!\n');
      console.log('✅ TikTok Compatibility: EXCELLENT');
      console.log('   - Appears as real home internet connection');
      console.log('   - Low chance of detection');
      console.log('   - Expected success rate: 70-90%\n');
      console.log('💡 Good to go! This proxy should work well.\n');
    } else if (proxyType === 'MOBILE') {
      console.log('✅ MOBILE PROXY DETECTED!\n');
      console.log('✅ TikTok Compatibility: EXCELLENT');
      console.log('   - Appears as mobile carrier connection');
      console.log('   - Very low chance of detection');
      console.log('   - Expected success rate: 80-95%\n');
      console.log('💡 Perfect! Mobile proxies work best for TikTok.\n');
    } else {
      console.log('⚠️  UNKNOWN PROXY TYPE\n');
      console.log('⚠️  TikTok Compatibility: UNCERTAIN');
      console.log('   - Unable to determine proxy type from ISP info');
      console.log('   - Test with actual TikTok links to verify\n');
      console.log('💡 Run quick-test.js to see if it works.\n');
    }
    
    // Test 3: IP reputation
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔍 IP REPUTATION CHECK\n');
    
    try {
      const ipQuality = await axios.get(`https://ipqualityscore.com/api/json/ip/free/${ipInfo.data.ip}`, {
        timeout: 10000,
        validateStatus: () => true
      });
      
      if (ipQuality.data) {
        console.log(`   Fraud Score: ${ipQuality.data.fraud_score || 'N/A'}/100`);
        console.log(`   VPN: ${ipQuality.data.vpn ? 'Yes ⚠️' : 'No ✅'}`);
        console.log(`   Tor: ${ipQuality.data.tor ? 'Yes ⚠️' : 'No ✅'}`);
        console.log(`   Proxy: ${ipQuality.data.proxy ? 'Yes ⚠️' : 'No ✅'}`);
        console.log(`   Bot Status: ${ipQuality.data.bot_status ? 'Detected ⚠️' : 'Clean ✅'}\n`);
      }
    } catch (e) {
      console.log('   (IP reputation check unavailable)\n');
    }
    
    // Test 4: Multiple rotations
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔄 ROTATION TEST (3 requests)\n');
    
    for (let i = 1; i <= 3; i++) {
      try {
        const rotateTest = await axios.get('https://api.ipify.org?format=json', {
          httpsAgent: new HttpsProxyAgent(proxyUrl),
          timeout: 10000,
          validateStatus: () => true
        });
        console.log(`   Request ${i}: ${rotateTest.data.ip || 'N/A'}`);
      } catch (e) {
        console.log(`   Request ${i}: Failed (${e.message})`);
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Proxy check complete!\n');
    
  } catch (error) {
    console.error('\n❌ Proxy check FAILED!\n');
    console.error(`Error: ${error.message}\n`);
    console.log('Possible issues:');
    console.log('   1. Incorrect proxy credentials');
    console.log('   2. Proxy server is down');
    console.log('   3. Network connectivity issues');
    console.log('   4. Firewall blocking proxy connection\n');
  }
}

checkProxyType().catch(console.error);
