const { useState, useEffect, useMemo } = React;

function App() {
  const [links, setLinks] = useState('');
  const [proxy, setProxy] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [captchaType, setCaptchaType] = useState('TIKTOK_OBJ');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [captchaUrl1, setCaptchaUrl1] = useState('');
  const [captchaUrl2, setCaptchaUrl2] = useState('');
  const [captchaResult, setCaptchaResult] = useState(null);
  const [results, setResults] = useState([]);
  const [note, setNote] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingNote, setEditingNote] = useState('');
  const [selectedIds, setSelectedIds] = useState([]); // for bulk select
  const [copiedId, setCopiedId] = useState(null); // show tiny copied hint per row
  const [loading, setLoading] = useState(false);
  const [ipInfo, setIpInfo] = useState(null);
  const [checkingIp, setCheckingIp] = useState(false);
  const [apiKeyInfo, setApiKeyInfo] = useState(null);
  const [checkingApiKey, setCheckingApiKey] = useState(false);
  const [concurrency, setConcurrency] = useState(2);
  const [asyncMode, setAsyncMode] = useState(false); // chống 524 qua Cloudflare Tunnel
  const [hoveredResultIndex, setHoveredResultIndex] = useState(null); // show copy on hover in results
  const [hoveredHistoryId, setHoveredHistoryId] = useState(null); // show copy on hover in history
  const [groupByShop, setGroupByShop] = useState(false); // group history by shop
  const [collapsedGroups, setCollapsedGroups] = useState({}); // key:boolean collapsed
  const [shopOnlyResults, setShopOnlyResults] = useState({}); // key: groupKey, value: { shopName, shopSold, loading, error }
  
  // Shop crawl states
  const [shopUrl, setShopUrl] = useState('');
  const [shopAmount, setShopAmount] = useState(30);
  const [crawlingShop, setCrawlingShop] = useState(false);
  const [shopApiKey, setShopApiKey] = useState('');
  const [shopCrawlProgress, setShopCrawlProgress] = useState('');
  
  // AI Analysis states
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [analyzingGrowth, setAnalyzingGrowth] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedShopForAnalysis, setSelectedShopForAnalysis] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState('');
  
  const shopCounts = useMemo(() => {
    const counts = {};
    for (const it of history) {
      const key = it.shopId || it.shopSlug || it.shopName || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [history]);
  
  // Progress tracking states
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentLink: '',
    stage: '',
    message: ''
  });

  useEffect(() => {
    const savedProxy = localStorage.getItem('tiktokProxy');
    if (savedProxy) setProxy(savedProxy);
    const savedApiKey = localStorage.getItem('hmcaptchaApiKey');
    if (savedApiKey) setApiKey(savedApiKey);
    const savedShopApiKey = localStorage.getItem('shopApiKey');
    if (savedShopApiKey) setShopApiKey(savedShopApiKey);
    const savedDeepseekKey = localStorage.getItem('deepseekApiKey');
    if (savedDeepseekKey) setDeepseekApiKey(savedDeepseekKey);
    const savedConc = parseInt(localStorage.getItem('crawlConcurrency') || '2', 10);
    if (!Number.isNaN(savedConc)) setConcurrency(Math.min(Math.max(savedConc, 1), 3));
    const savedAsync = localStorage.getItem('crawlAsyncMode');
    const isTunnel = typeof location !== 'undefined' && /trycloudflare\.com$/i.test(location.hostname);
    setAsyncMode(savedAsync ? savedAsync === '1' : isTunnel); // auto enable on tunnel
    const savedGroup = localStorage.getItem('historyGroupByShop');
    if (savedGroup) {
      setGroupByShop(savedGroup === '1');
    } else {
      // default ON for better manageability if user hasn't chosen yet
      setGroupByShop(true);
      localStorage.setItem('historyGroupByShop', '1');
    }
    // load collapsed groups state
    try {
      const raw = localStorage.getItem('collapsedGroups');
      if (raw) setCollapsedGroups(JSON.parse(raw));
    } catch {}
  }, []);

  const handleSaveProxy = () => {
    localStorage.setItem('tiktokProxy', proxy);
    alert('✅ Proxy đã được lưu!');
  };

  const handleToggleGroupByShop = (on) => {
    setGroupByShop(on);
    localStorage.setItem('historyGroupByShop', on ? '1' : '0');
  };

  const handleRecrawlGroup = async (items) => {
    const urls = items.map(i => i.url);
    if (urls.length === 0) return;
    await handleCrawl(urls);
  };

  const handleCrawlShopOnly = async (groupKey, items) => {
    if (!items || items.length === 0) return;
    
    // Take first item's URL to get shop info
    const firstUrl = items[0].url;
    
    if (!proxy) {
      setShopOnlyResults(prev => ({
        ...prev,
        [groupKey]: { error: 'Vui lòng nhập proxy trước!', loading: false }
      }));
      return;
    }
    
    // Set loading state
    setShopOnlyResults(prev => ({
      ...prev,
      [groupKey]: { loading: true, error: null }
    }));
    
    try {
      const res = await fetch('/api/crawl-shop-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: firstUrl, 
          proxy: proxy.trim(),
          apiKey: apiKey.trim()
        }),
        credentials: 'include'
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.success) {
        setShopOnlyResults(prev => ({
          ...prev,
          [groupKey]: { 
            shopName: data.shopName, 
            shopSold: data.shopSold,
            growth: data.growth,
            loading: false,
            error: null
          }
        }));
        // Reload history to show updated data
        loadHistory();
      } else {
        throw new Error(data.error || 'Crawl failed');
      }
    } catch (e) {
      setShopOnlyResults(prev => ({
        ...prev,
        [groupKey]: { error: e.message, loading: false }
      }));
    }
  };

  const setGroupCollapsed = (key, val) => {
    setCollapsedGroups(prev => {
      const next = { ...prev, [key]: val };
      try { localStorage.setItem('collapsedGroups', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const collapseAllGroups = (keys) => {
    const next = {};
    for (const k of keys) next[k] = true;
    setCollapsedGroups(next);
    try { localStorage.setItem('collapsedGroups', JSON.stringify(next)); } catch {}
  };

  const expandAllGroups = (keys) => {
    const next = {};
    for (const k of keys) next[k] = false;
    setCollapsedGroups(next);
    try { localStorage.setItem('collapsedGroups', JSON.stringify(next)); } catch {}
  };

  const handleDeleteGroup = async (items) => {
    if (!items || items.length === 0) return;
    if (!confirm(`Xóa tất cả ${items.length} mục trong nhóm này?`)) return;
    for (const it of items) {
      try { await fetch(`/api/history/${it.id}`, { method: 'DELETE', credentials: 'include' }); } catch {}
    }
    await loadHistory();
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('hmcaptchaApiKey', apiKey);
    alert('✅ API Key đã được lưu!');
  };

  const handleCheckIp = async () => {
    if (!proxy) {
      alert('⚠️ Vui lòng nhập proxy trước!');
      return;
    }
    setCheckingIp(true);
    setIpInfo(null);
    try {
      const res = await fetch('/api/check-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxy }),
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
      }
      
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Backend không phản hồi JSON. Kiểm tra backend server.');
      }
      
      const data = await res.json();
      setIpInfo(data);
    } catch (e) {
      setIpInfo({ error: 'Không thể kết nối tới backend: ' + e.message });
    }
    setCheckingIp(false);
  };

  const handleCheckApiKey = async () => {
    if (!apiKey) {
      alert('⚠️ Vui lòng nhập API Key trước!');
      return;
    }
    setCheckingApiKey(true);
    setApiKeyInfo(null);
    try {
      const res = await fetch('/api/check-apikey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
      }
      
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Backend không phản hồi JSON. Kiểm tra backend server.');
      }
      
      const data = await res.json();
      setApiKeyInfo(data);
    } catch (e) {
      setApiKeyInfo({ error: 'Không thể kết nối tới backend: ' + e.message });
    }
    setCheckingApiKey(false);
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch('/api/history', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        setHistory(items);
        // Clear selections when data refreshes
        setSelectedIds([]);
      }
    } catch (e) {
      console.error('Load history error:', e.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const handleCrawlShop = async () => {
    if (!shopUrl.trim()) {
      setShopCrawlProgress('⚠️ Vui lòng nhập Shop URL!');
      setTimeout(() => setShopCrawlProgress(''), 3000);
      return;
    }
    
    if (!shopApiKey.trim()) {
      setShopCrawlProgress('⚠️ Vui lòng nhập API Key cho scrapecreators.com!');
      setTimeout(() => setShopCrawlProgress(''), 3000);
      return;
    }

    setCrawlingShop(true);
    setResults([]);
    setShopCrawlProgress('🔍 Đang kết nối tới scrapecreators.com...');

    try {
      setShopCrawlProgress('📡 Đang lấy danh sách sản phẩm từ shop...');
      
      const res = await fetch('/api/crawl-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopUrl: shopUrl.trim(),
          amount: shopAmount || 30,
          apiKey: shopApiKey.trim(),
          note: note || 'Crawled via Shop API'
        }),
        credentials: 'include'
      });

      setShopCrawlProgress('⏳ Đang xử lý dữ liệu...');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      if (data.success) {
        setShopCrawlProgress(`✅ Crawl thành công ${data.totalSaved} sản phẩm từ shop "${data.shopInfo.name}"!`);
        
        console.log('📦 Shop Info:', data.shopInfo);
        console.log('📦 Products saved:', data.totalSaved);
        
        // Reload history to show new products
        setShopCrawlProgress('🔄 Đang tải lại lịch sử...');
        await loadHistory();
        
        // Clear shop URL after success
        setShopUrl('');
        
        // Auto-hide success message after 3s
        setTimeout(() => setShopCrawlProgress(''), 3000);
      } else {
        throw new Error('Crawl không thành công');
      }

    } catch (error) {
      console.error('❌ Error crawling shop:', error);
      setShopCrawlProgress(`❌ Lỗi: ${error.message}`);
      setTimeout(() => setShopCrawlProgress(''), 5000);
    } finally {
      setCrawlingShop(false);
    }
  };

  const handleAnalyzeGrowth = async (shopName, shopId) => {
    if (!deepseekApiKey.trim()) {
      setAnalysisProgress('⚠️ Vui lòng nhập DeepSeek API Key!');
      setTimeout(() => setAnalysisProgress(''), 3000);
      return;
    }

    setAnalyzingGrowth(true);
    setSelectedShopForAnalysis(shopName);
    setAnalysisResult(null);
    setAnalysisProgress('🔍 Đang thu thập dữ liệu...');

    try {
      setAnalysisProgress('📡 Đang gửi request đến server...');
      
      const res = await fetch('/api/analyze-growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: shopName,
          shopId: shopId,
          deepseekApiKey: deepseekApiKey.trim()
        }),
        credentials: 'include'
      });

      setAnalysisProgress('⏳ Đang chờ phản hồi từ server...');

      // Check if response is JSON
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('❌ Non-JSON response:', text);
        throw new Error('Server trả về response không đúng format. Kiểm tra console để xem chi tiết.');
      }

      const data = await res.json();
      setAnalysisProgress('🤖 Đang xử lý kết quả từ AI...');
      
      console.log('📊 Analysis response:', data);
      console.log('📊 Analysis result keys:', Object.keys(data));

      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      if (data.success) {
        console.log('✅ Setting analysis result:', {
          hasShopInfo: !!data.shopInfo,
          hasTopProducts: !!data.topProducts,
          hasAiAnalysis: !!data.aiAnalysis,
          topProductsCount: data.topProducts?.length
        });
        
        // Clean markdown symbols from AI analysis
        if (data.aiAnalysis) {
          data.aiAnalysis = data.aiAnalysis
            .replace(/#{1,6}\s/g, '') // Remove # headers
            .replace(/\*\*/g, '')      // Remove ** bold
            .replace(/\*/g, '')        // Remove * italic
            .replace(/`/g, '')         // Remove ` code
            .replace(/^[-*]\s/gm, '• '); // Replace - or * lists with •
        }
        
        setAnalysisResult(data);
        setAnalysisProgress('✅ Phân tích hoàn tất!');
        console.log('✅ Analysis result set successfully');
        
        // Scroll to analysis result after a short delay
        setTimeout(() => {
          const analysisSection = document.querySelector('[key="analysis-result"]');
          if (analysisSection) {
            analysisSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          setAnalysisProgress('');
        }, 1500);
      } else {
        throw new Error('Phân tích không thành công');
      }

    } catch (error) {
      console.error('❌ Error analyzing growth:', error);
      setAnalysisProgress(`❌ Lỗi: ${error.message}`);
      setTimeout(() => setAnalysisProgress(''), 5000);
    } finally {
      setAnalyzingGrowth(false);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('Xóa mục này?')) return;
    const res = await fetch(`/api/history/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) loadHistory();
  };

  const handleRecrawlItem = async (url) => {
    await handleCrawl([url]);
  };

  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditingNote(item.note || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingNote('');
  };

  const handleSaveEdit = async (item) => {
    try {
      const res = await fetch('/api/history/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: item.url, note: editingNote })
      });
      if (!res.ok) throw new Error('Lưu ghi chú thất bại');
      await loadHistory();
      handleCancelEdit();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleCrawl = async (forcedLinksOrEvent) => {
    setLoading(true);
    setResults([]);
    
    // If called from onClick directly, the first arg is a click event (SyntheticEvent)
    const isEvent = forcedLinksOrEvent && (typeof forcedLinksOrEvent === 'object') && ('preventDefault' in forcedLinksOrEvent || ('nativeEvent' in forcedLinksOrEvent));
    const linkArray = Array.isArray(forcedLinksOrEvent) && !isEvent
      ? forcedLinksOrEvent
      : links.split('\n').filter(l => l.trim());
    setProgress({
      current: 0,
      total: linkArray.length,
      currentLink: linkArray[0] || '',
      stage: 'starting',
      message: 'Đang khởi động...'
    });

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev.current >= prev.total) return prev;
        
        const newCurrent = Math.min(prev.current + 1, prev.total);
        const stages = ['loading', 'checking_captcha', 'extracting'];
        const randomStage = stages[Math.floor(Math.random() * stages.length)];
        
        return {
          ...prev,
          current: newCurrent,
          currentLink: linkArray[newCurrent] || prev.currentLink,
          stage: randomStage,
          message: `Đang xử lý link ${newCurrent}/${prev.total}...`
        };
      });
    }, 15000);

    try {
      if (asyncMode) {
        // Fire-and-poll async job to avoid 524
        const startRes = await fetch('/api/crawl-async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ links: linkArray, proxy, apiKey, note, concurrency }),
          credentials: 'include'
        });
        if (!startRes.ok) throw new Error(`Start job failed: ${startRes.status}`);
        const startData = await startRes.json();
        if (!startData.jobId) throw new Error('Không nhận được jobId');
        const jobId = startData.jobId;
        // Poll every 3s
        const poll = async () => {
          const jr = await fetch(`/api/crawl-async/${jobId}`, { credentials: 'include' });
          if (!jr.ok) throw new Error('Mất kết nối job');
          const jd = await jr.json();
          setProgress(prev => ({
            ...prev,
            current: jd.completed || 0,
            total: jd.total || linkArray.length,
            stage: jd.status === 'done' ? 'done' : jd.status === 'error' ? 'error' : 'loading',
            message: jd.status === 'error' ? (jd.error || 'Job lỗi') : `Đang xử lý... ${jd.completed}/${jd.total}`
          }));
          if (jd.status === 'done') {
            clearInterval(progressInterval);
            setResults(Array.isArray(jd.results) ? jd.results : []);
            loadHistory();
            return true;
          }
          if (jd.status === 'error') {
            clearInterval(progressInterval);
            throw new Error(jd.error || 'Job lỗi');
          }
          return false;
        };
        // Simple polling loop
        let finished = false;
        const maxPoll = 120; // ~6 minutes
        for (let i = 0; i < maxPoll && !finished; i++) {
          // eslint-disable-next-line no-await-in-loop
          finished = await poll();
          if (!finished) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise(r => setTimeout(r, 3000));
          }
        }
        if (!finished) throw new Error('Hết thời gian chờ job');
      } else {
        const res = await fetch('/api/crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ links: linkArray, proxy, apiKey, note, concurrency }),
          credentials: 'include'
        });
        
        if (!res.ok) {
          throw new Error(`Server error: ${res.status} ${res.statusText}`);
        }
        
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Backend không phản hồi JSON. Kiểm tra backend server.');
        }
        
        const data = await res.json();
        
        clearInterval(progressInterval);
        
        if (data.results) {
          setResults(data.results);
          const successCount = data.results.filter(r => !r.error).length;
          setProgress({
            current: linkArray.length,
            total: linkArray.length,
            currentLink: '',
            stage: 'done',
            message: `✅ Hoàn thành! Thành công: ${successCount}/${linkArray.length} links`
          });
          // reload history after successful crawl
          loadHistory();
        }
      }
    } catch (e) {
      clearInterval(progressInterval);
      alert('Lỗi: ' + e.message);
      setProgress({
        ...progress,
        stage: 'error',
        message: '❌ Lỗi: ' + e.message
      });
    }
    setLoading(false);
  };

  // Selection helpers
  const toggleSelectAll = () => {
    if (selectedIds.length === history.length && history.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(history.map(h => h.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Xóa ${selectedIds.length} mục đã chọn?`)) return;
    // delete sequentially to avoid overwhelming backend
    for (const id of selectedIds) {
      try {
        await fetch(`/api/history/${id}`, { method: 'DELETE', credentials: 'include' });
      } catch (e) {
        console.error('Bulk delete error for', id, e.message);
      }
    }
    await loadHistory();
    setSelectedIds([]);
  };

  const handleBulkRecrawl = async () => {
    if (selectedIds.length === 0) return;
    const urls = history.filter(h => selectedIds.includes(h.id)).map(h => h.url);
    if (urls.length === 0) return;
    await handleCrawl(urls);
  };

  const copyToClipboard = async (text, id) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch (e) {
      alert('Không thể copy: ' + e.message);
    }
  };

  // Modern styled components
  const GlassCard = ({ children, style = {} }) => {
    return React.createElement('div', {
      style: {
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        marginBottom: '24px',
        ...style
      }
    }, children);
  };

  // ===== Stats (Charts) =====
  const topShops = useMemo(() => {
    // compute top 10 shops by count
    const byShop = {};
    for (const it of history) {
      const key = it.shopId || it.shopSlug || it.shopName || 'Unknown Shop';
      if (!byShop[key]) byShop[key] = { name: it.shopName || it.shopSlug || 'Unknown Shop', count: 0 };
      byShop[key].count++;
    }
    return Object.values(byShop).sort((a,b) => b.count - a.count).slice(0, 10);
  }, [history]);

  const statusDist = useMemo(() => {
    // derive status buckets from results+history recent view
    const buckets = { success: 0, cheerio: 0, geo: 0, error: 0 };
    const consider = Array.isArray(results) && results.length > 0 ? results : history;
    for (const it of consider) {
      // Nếu có field status (từ results), dùng status
      if (it.status) {
        const s = (it.status || '').toLowerCase();
        if (s.startsWith('success')) buckets.success++;
        else if (s.includes('cheerio')) buckets.cheerio++;
        else if (s.includes('geo')) buckets.geo++;
        else buckets.error++;
      } else {
        // Nếu không có status (từ history), kiểm tra xem có dữ liệu không
        // Thành công = có productName hoặc productSold hoặc shopSold
        if (it.productName || it.productSold || it.shopSold) {
          buckets.success++;
        } else {
          buckets.error++;
        }
      }
    }
    return buckets;
  }, [results, history]);

  useEffect(() => {
    // render charts when data changes; Chart.js loaded via index.html
    if (typeof Chart === 'undefined') return;
    
    // Top shops chart - Enhanced bar chart
    const ctx1 = document.getElementById('chart-topshops');
    if (ctx1) {
      if (ctx1._chart) ctx1._chart.destroy();
      
      // Create gradient for bars
      const gradient = ctx1.getContext('2d').createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, 'rgba(102, 126, 234, 0.9)');
      gradient.addColorStop(1, 'rgba(118, 75, 162, 0.7)');
      
      ctx1._chart = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: topShops.map(s => s.name),
          datasets: [{
            label: 'Số sản phẩm',
            data: topShops.map(s => s.count),
            backgroundColor: gradient,
            borderRadius: 8,
            borderSkipped: false,
            barThickness: 40,
            maxBarThickness: 50
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 750,
            easing: 'easeInOutQuart'
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleFont: { size: 14, weight: 'bold' },
              bodyFont: { size: 13 },
              padding: 12,
              cornerRadius: 8,
              displayColors: false,
              callbacks: {
                label: function(context) {
                  return 'Số sản phẩm: ' + context.parsed.y;
                }
              }
            },
            datalabels: {
              display: false
            }
          },
          scales: {
            x: {
              grid: {
                display: false
              },
              ticks: {
                font: { size: 11, weight: '500' },
                color: '#6b7280',
                maxRotation: 45,
                minRotation: 0
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.05)',
                drawBorder: false
              },
              ticks: {
                font: { size: 11 },
                color: '#6b7280',
                precision: 0,
                callback: function(value) {
                  if (Math.floor(value) === value) {
                    return value;
                  }
                }
              }
            }
          }
        }
      });
    }
    
    // Status distribution chart - Enhanced doughnut
    const ctx2 = document.getElementById('chart-status');
    if (ctx2) {
      if (ctx2._chart) ctx2._chart.destroy();
      
      const totalCount = statusDist.success + statusDist.cheerio + statusDist.geo + statusDist.error;
      
      ctx2._chart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: ['Thành công', 'Cheerio', 'Geo-block', 'Lỗi/Khác'],
          datasets: [{
            data: [statusDist.success, statusDist.cheerio, statusDist.geo, statusDist.error],
            backgroundColor: ['#34d399', '#60a5fa', '#fbbf24', '#f87171'],
            borderWidth: 3,
            borderColor: '#ffffff',
            hoverOffset: 12,
            hoverBorderWidth: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            animateRotate: true,
            animateScale: true,
            duration: 800,
            easing: 'easeInOutQuart'
          },
          cutout: '65%',
          plugins: {
            legend: {
              display: true,
              position: 'right',
              labels: {
                font: { size: 12, weight: '500', family: 'Inter' },
                color: '#374151',
                padding: 15,
                usePointStyle: true,
                pointStyle: 'circle',
                generateLabels: function(chart) {
                  const data = chart.data;
                  if (data.labels.length && data.datasets.length) {
                    return data.labels.map((label, i) => {
                      const value = data.datasets[0].data[i];
                      const percentage = totalCount > 0 ? ((value / totalCount) * 100).toFixed(1) : '0.0';
                      return {
                        text: label + ': ' + value + ' (' + percentage + '%)',
                        fillStyle: data.datasets[0].backgroundColor[i],
                        hidden: false,
                        index: i
                      };
                    });
                  }
                  return [];
                }
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              titleFont: { size: 14, weight: 'bold' },
              bodyFont: { size: 13 },
              padding: 12,
              cornerRadius: 8,
              displayColors: true,
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed;
                  const percentage = totalCount > 0 ? ((value / totalCount) * 100).toFixed(1) : '0.0';
                  return label + ': ' + value + ' (' + percentage + '%)';
                }
              }
            }
          }
        }
      });
    }
  }, [topShops, statusDist]);

  // Helper function to format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '—';
    try {
      const date = new Date(timestamp);
      
      // Format as DD/MM/YYYY HH:mm
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      const secs = String(date.getSeconds()).padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
    } catch (e) {
      return '—';
    }
  };

  const Input = ({ value, onChange, placeholder, type = 'text', style = {}, disabled = false }) => {
    return React.createElement('input', {
      type,
      value,
      onChange,
      placeholder,
      disabled,
      style: {
        width: '100%',
        padding: '10px 14px',
        border: '1px solid var(--color-gray-300)',
        borderRadius: 'var(--radius-md)',
        fontSize: '14px',
        fontFamily: 'Inter, sans-serif',
        transition: 'all 0.2s ease',
        background: 'white',
        outline: 'none',
        color: 'var(--color-gray-900)',
        ...style
      },
      onFocus: (e) => {
        e.target.style.borderColor = 'var(--color-primary)';
        e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
      },
      onBlur: (e) => {
        e.target.style.borderColor = 'var(--color-gray-300)';
        e.target.style.boxShadow = 'none';
      }
    });
  };

  const Badge = ({ children, variant = 'primary' }) => {
    const variants = {
      primary: { bg: 'var(--color-primary-light)', color: 'var(--color-primary)' },
      success: { bg: '#d1fae5', color: 'var(--color-success)' },
      error: { bg: '#fee2e2', color: 'var(--color-error)' },
      warning: { bg: '#fef3c7', color: 'var(--color-warning)' },
      info: { bg: '#cffafe', color: 'var(--color-info)' }
    };

    const selected = variants[variant] || variants.primary;

    return React.createElement('span', {
      style: {
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: 'var(--radius-md)',
        fontSize: '13px',
        fontWeight: '600',
        background: selected.bg,
        color: selected.color,
        border: `1px solid ${selected.color}20`
      }
    }, children);
  };

  const Button = ({ children, onClick, variant = 'primary', disabled = false, style = {} }) => {
    const variants = {
      primary: {
        bg: 'var(--color-primary)',
        bgHover: 'var(--color-primary-hover)',
        color: 'white',
        border: 'transparent'
      },
      secondary: {
        bg: 'white',
        bgHover: 'var(--color-gray-50)',
        color: 'var(--color-gray-700)',
        border: 'var(--color-gray-300)'
      },
      danger: {
        bg: 'var(--color-error)',
        bgHover: '#dc2626',
        color: 'white',
        border: 'transparent'
      }
    };

    const selected = variants[variant] || variants.primary;

    return React.createElement('button', {
      onClick: disabled ? undefined : onClick,
      disabled,
      style: {
        padding: '10px 16px',
        borderRadius: 'var(--radius-md)',
        fontSize: '14px',
        fontWeight: '500',
        fontFamily: 'Inter, sans-serif',
        border: `1px solid ${selected.border}`,
        background: disabled ? 'var(--color-gray-200)' : selected.bg,
        color: disabled ? 'var(--color-gray-500)' : selected.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        outline: 'none',
        boxShadow: disabled ? 'none' : 'var(--shadow-sm)',
        ...style
      },
      onMouseEnter: disabled ? undefined : (e) => {
        e.target.style.background = selected.bgHover;
        e.target.style.boxShadow = 'var(--shadow-md)';
        e.target.style.transform = 'translateY(-1px)';
      },
      onMouseLeave: disabled ? undefined : (e) => {
        e.target.style.background = selected.bg;
        e.target.style.boxShadow = 'var(--shadow-sm)';
        e.target.style.transform = 'translateY(0)';
      }
    }, children);
  };

  return React.createElement(
    'div',
    { style: { fontFamily: 'Inter, sans-serif' } },
    
    // Header - Professional Design
    React.createElement('div', { 
      style: { 
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-xl)',
        marginBottom: 'var(--space-lg)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--color-gray-200)'
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-md)'
        }
      }, [
        React.createElement('div', { key: 'logo-section', style: { display: 'flex', alignItems: 'center', gap: 'var(--space-md)' } }, [
          React.createElement('div', { 
            key: 'icon',
            style: { 
              fontSize: '32px',
              lineHeight: 1
            }
          }, '📊'),
          React.createElement('div', { key: 'text' }, [
            React.createElement('h1', { 
              key: 'title',
              style: { 
                fontSize: '24px',
                fontWeight: '700',
                color: 'var(--color-gray-900)',
                marginBottom: '2px',
                letterSpacing: '-0.5px'
              }
            }, 'TikTok Shop Crawler'),
            React.createElement('p', { 
              key: 'subtitle',
              style: { 
                fontSize: '14px',
                color: 'var(--color-gray-500)',
                fontWeight: '400'
              }
            }, 'Professional Data Extraction Platform')
          ])
        ]),
        React.createElement('div', { key: 'stats-badge', style: { display: 'flex', gap: 'var(--space-sm)' } }, [
          history.length > 0 && React.createElement(Badge, { key: 'total', variant: 'info' }, `${history.length} Products`),
          Object.keys(shopCounts).length > 0 && React.createElement(Badge, { key: 'shops', variant: 'success' }, `${Object.keys(shopCounts).length} Shops`)
        ])
      ])
    ),

    // Proxy Section
    React.createElement(GlassCard, { 
      children: [
        React.createElement('h3', { 
          key: 'proxy-title',
          style: { 
            marginBottom: '16px', 
            fontSize: '18px',
            fontWeight: '600',
            color: '#333'
          } 
        }, '🌐 Cấu hình Proxy'),
        React.createElement('div', { 
          key: 'proxy-input',
          style: { marginBottom: '16px' } 
        },
          React.createElement(Input, {
            value: proxy,
            onChange: e => setProxy(e.target.value),
            placeholder: 'Ví dụ: 43.159.20.117:12233:user-xxx:password'
          })
        ),
        React.createElement('div', { 
          key: 'proxy-buttons',
          style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } 
        },
          React.createElement(Button, { onClick: handleSaveProxy, variant: 'secondary' }, '💾 Lưu Proxy'),
          React.createElement(Button, { onClick: handleCheckIp, disabled: checkingIp, variant: 'success' }, 
            checkingIp ? 'Đang kiểm tra...' : '🔍 Kiểm tra IP'
          )
        ),
        ipInfo && React.createElement('div', {
          key: 'ip-info',
          style: {
            marginTop: '16px',
            padding: '16px 20px',
            borderRadius: '12px',
            background: ipInfo.error 
              ? 'linear-gradient(135deg, rgba(235, 51, 73, 0.1) 0%, rgba(244, 92, 67, 0.1) 100%)'
              : 'linear-gradient(135deg, rgba(17, 153, 142, 0.1) 0%, rgba(56, 239, 125, 0.1) 100%)',
            borderLeft: `4px solid ${ipInfo.error ? '#f45c43' : '#38ef7d'}`
          }
        },
          ipInfo.error 
            ? React.createElement('div', { style: { color: '#c62828', fontWeight: '500' } }, '❌ ' + ipInfo.error)
            : React.createElement('div', null,
                React.createElement('div', { 
                  key: 'ip-success',
                  style: { fontWeight: 'bold', marginBottom: 8, color: '#0d7a6f', fontSize: '15px' } 
                }, '✅ Proxy đang hoạt động!'),
                React.createElement('div', { key: 'ip-1', style: { marginBottom: 4, fontSize: '14px' } }, 
                  '📍 IP: ', React.createElement('strong', null, ipInfo.ip)
                ),
                React.createElement('div', { key: 'ip-2', style: { marginBottom: 4, fontSize: '14px' } }, 
                  '🌍 Location: ', React.createElement('strong', null, ipInfo.location)
                ),
                React.createElement('div', { key: 'ip-3', style: { marginBottom: 4, fontSize: '14px' } }, 
                  '🏢 ISP: ', React.createElement('strong', null, ipInfo.org)
                ),
                ipInfo.isDatacenter && React.createElement('div', { 
                  key: 'ip-warn',
                  style: { marginTop: 8, color: '#f57c00', fontWeight: 'bold', fontSize: '14px' } 
                }, '⚠️ WARNING: Datacenter proxy'),
                ipInfo.timezone && React.createElement('div', { 
                  key: 'ip-4',
                  style: { marginBottom: 4, fontSize: '14px' } 
                }, '🕐 Timezone: ', React.createElement('strong', null, ipInfo.timezone))
              )
        )
      ]
    }),

    // API Key Section
    React.createElement(GlassCard, {
      children: [
        React.createElement('h3', { 
          key: 'api-title',
          style: { 
            marginBottom: '16px', 
            fontSize: '18px',
            fontWeight: '600',
            color: '#333'
          } 
        }, '🔑 API Key hmcaptcha.com'),
        React.createElement('div', { 
          key: 'api-input',
          style: { marginBottom: '16px' } 
        },
          React.createElement(Input, {
            value: apiKey,
            onChange: e => setApiKey(e.target.value),
            placeholder: 'Nhập API Key từ hmcaptcha.com',
            type: 'password'
          })
        ),
        React.createElement('div', { 
          key: 'api-buttons',
          style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } 
        },
          React.createElement(Button, { onClick: handleSaveApiKey, variant: 'secondary' }, '💾 Lưu API Key'),
          React.createElement(Button, { onClick: handleCheckApiKey, disabled: checkingApiKey, variant: 'success' }, 
            checkingApiKey ? 'Đang kiểm tra...' : '✓ Kiểm tra API Key'
          )
        ),
        apiKeyInfo && React.createElement('div', {
          key: 'api-info',
          style: {
            marginTop: '16px',
            padding: '16px 20px',
            borderRadius: '12px',
            background: apiKeyInfo.error 
              ? 'linear-gradient(135deg, rgba(235, 51, 73, 0.1) 0%, rgba(244, 92, 67, 0.1) 100%)'
              : 'linear-gradient(135deg, rgba(17, 153, 142, 0.1) 0%, rgba(56, 239, 125, 0.1) 100%)',
            borderLeft: `4px solid ${apiKeyInfo.error ? '#f45c43' : '#38ef7d'}`,
            fontSize: '14px',
            fontWeight: '500'
          }
        },
          apiKeyInfo.error 
            ? React.createElement('div', { style: { color: '#c62828' } }, '❌ ' + apiKeyInfo.error)
            : React.createElement('div', { style: { color: '#0d7a6f' } }, '✅ API Key hợp lệ!')
        )
      ]
    }),

    // Links Input Section
    React.createElement(GlassCard, {
      children: [
        React.createElement('h3', { 
          key: 'links-title',
          style: { 
            marginBottom: '16px', 
            fontSize: '18px',
            fontWeight: '600',
            color: '#333'
          } 
        }, '📝 Danh sách Links'),
        React.createElement('div', { key: 'conc-row', style: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' } }, [
          React.createElement('label', { key: 'conc-label', style: { fontSize: 14, color: '#374151', fontWeight: 600 } }, 'Tốc độ crawl:'),
          React.createElement('select', { key: 'conc-select', value: concurrency, onChange: e => { const v = Math.min(Math.max(parseInt(e.target.value,10)||2,1),3); setConcurrency(v); localStorage.setItem('crawlConcurrency', String(v)); }, style: { padding: '10px 12px', borderRadius: 10, border: '2px solid #e5e7eb', background: 'white' } }, [
            React.createElement('option', { key: 1, value: 1 }, '1 luồng (An toàn nhất, ít CAPTCHA)'),
            React.createElement('option', { key: 2, value: 2 }, '2 luồng (Cân bằng)'),
            React.createElement('option', { key: 3, value: 3 }, '3 luồng (Nhanh nhưng dễ bị chặn)')
          ]),
          concurrency === 3 && React.createElement('span', { key: 'conc-warn', style: { fontSize: 12, color: '#dc2626', fontWeight: 600 } }, '⚠️ 3 luồng tăng nguy cơ CAPTCHA/gate! Khuyến nghị giảm xuống 1-2.')
        ]),
        React.createElement('div', { key: 'async-row', style: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 } }, [
          React.createElement('input', { key: 'async-checkbox', type: 'checkbox', checked: asyncMode, onChange: e => { const on = e.target.checked; setAsyncMode(on); localStorage.setItem('crawlAsyncMode', on ? '1' : '0'); } }),
          React.createElement('span', { key: 'async-label', style: { fontSize: 14, color: '#374151' } }, 'Chế độ chống 524 (chạy nền + polling)')
        ]),
        React.createElement('textarea', {
          key: 'links-input',
          value: links,
          onChange: e => setLinks(e.target.value),
          placeholder: 'Nhập các link TikTok (mỗi link một dòng)...',
          rows: 8,
          style: {
            width: '100%',
            padding: '14px 18px',
            border: '2px solid #e0e0e0',
            borderRadius: '12px',
            fontSize: '15px',
            fontFamily: 'Inter, sans-serif',
            transition: 'all 0.3s ease',
            background: 'white',
            outline: 'none',
            resize: 'vertical'
          }
        }),
        React.createElement('div', { 
          key: 'links-button',
          style: { marginTop: '16px', textAlign: 'center' } 
        },
          React.createElement(Button, { 
            onClick: () => handleCrawl(), 
            disabled: loading || !links.trim(),
            variant: 'primary',
            style: { 
              fontSize: '16px', 
              padding: '16px 40px',
              minWidth: '200px'
            } 
          }, loading ? 'Đang xử lý...' : '🚀 Bắt đầu Crawl')
        )
      ]
    }),

    // Shop Crawl Section
    React.createElement('div', {
      key: 'shop-crawl-section',
      style: {
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-lg)',
        marginBottom: 'var(--space-lg)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--color-gray-200)'
      }
    }, [
      React.createElement('div', {
        key: 'header',
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-md)',
          paddingBottom: 'var(--space-sm)',
          borderBottom: '1px solid var(--color-gray-200)'
        }
      }, [
        React.createElement('span', { key: 'icon', style: { fontSize: 24 } }, '🏪'),
        React.createElement('h3', {
          key: 'title',
          style: {
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--color-gray-900)'
          }
        }, 'Crawl tất cả sản phẩm Shop'),
        React.createElement(Badge, { key: 'new-badge', variant: 'info' }, 'Mới')
      ]),
      
      React.createElement('div', { key: 'content', style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' } }, [
        // Shop crawl progress bar
        shopCrawlProgress && React.createElement('div', {
          key: 'shop-progress-bar',
          style: {
            background: shopCrawlProgress.startsWith('❌') ? '#fee2e2' : shopCrawlProgress.startsWith('✅') ? '#dcfce7' : '#dbeafe',
            border: `1px solid ${shopCrawlProgress.startsWith('❌') ? '#fecaca' : shopCrawlProgress.startsWith('✅') ? '#bbf7d0' : '#bfdbfe'}`,
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-sm)',
            fontSize: '13px',
            fontWeight: '500',
            color: shopCrawlProgress.startsWith('❌') ? '#991b1b' : shopCrawlProgress.startsWith('✅') ? '#166534' : 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
            animation: 'fadeIn 0.3s ease-in'
          }
        }, [
          !shopCrawlProgress.startsWith('✅') && !shopCrawlProgress.startsWith('❌') && React.createElement('div', {
            key: 'spinner',
            style: {
              width: '14px',
              height: '14px',
              border: '2px solid var(--color-primary)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite'
            }
          }),
          React.createElement('span', { key: 'text' }, shopCrawlProgress)
        ]),
        
        React.createElement('div', { key: 'shop-url-row' },
          React.createElement(Input, {
            value: shopUrl,
            onChange: e => setShopUrl(e.target.value),
            placeholder: 'Nhập Shop URL (vd: https://www.tiktok.com/@shopname)',
            disabled: crawlingShop
          })
        ),
        
        React.createElement('div', { key: 'amount-api-row', style: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-md)' } }, [
          React.createElement('div', { key: 'amount' },
            React.createElement('label', {
              style: {
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--color-gray-700)',
                marginBottom: 'var(--space-xs)'
              }
            }, 'Số lượng sản phẩm'),
            React.createElement(Input, {
              type: 'number',
              value: shopAmount,
              onChange: e => setShopAmount(parseInt(e.target.value) || 30),
              placeholder: '30',
              disabled: crawlingShop,
              style: { width: '100%' }
            })
          ),
          React.createElement('div', { key: 'api-key' },
            React.createElement('label', {
              style: {
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--color-gray-700)',
                marginBottom: 'var(--space-xs)'
              }
            }, 'API Key (scrapecreators.com)'),
            React.createElement('div', { style: { display: 'flex', gap: 'var(--space-sm)' } }, [
              React.createElement(Input, {
                key: 'input',
                value: shopApiKey,
                onChange: e => setShopApiKey(e.target.value),
                placeholder: 'Nhập API key...',
                type: 'password',
                disabled: crawlingShop,
                style: { flex: 1 }
              }),
              shopApiKey && React.createElement(Button, {
                key: 'save-btn',
                onClick: () => {
                  localStorage.setItem('shopApiKey', shopApiKey);
                  setShopCrawlProgress('✅ API Key đã được lưu!');
                  setTimeout(() => setShopCrawlProgress(''), 2000);
                },
                variant: 'secondary'
              }, '💾 Lưu')
            ])
          )
        ]),
        
        React.createElement('div', { key: 'info-box', style: { background: 'var(--color-info)/10', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--color-gray-600)' } },
          '💡 API này sử dụng scrapecreators.com (cost: 1 credit/30 products). Lấy API key tại: ',
          React.createElement('a', { href: 'https://scrapecreators.com', target: '_blank', style: { color: 'var(--color-primary)', textDecoration: 'underline' } }, 'scrapecreators.com')
        ),
        
        React.createElement('div', { key: 'button-row', style: { display: 'flex', gap: 'var(--space-sm)' } }, [
          React.createElement(Button, {
            key: 'crawl-btn',
            onClick: handleCrawlShop,
            disabled: crawlingShop || !shopUrl.trim() || !shopApiKey.trim(),
            variant: 'primary',
            style: { flex: 1 }
          }, crawlingShop ? '⏳ Đang crawl shop...' : '🚀 Crawl Shop Products'),
          
          shopApiKey && React.createElement(Button, {
            key: 'save-api',
            onClick: () => {
              localStorage.setItem('shopApiKey', shopApiKey);
              alert('✅ API Key đã được lưu!');
            },
            variant: 'secondary'
          }, '💾 Lưu API Key')
        ])
      ])
    ]),

    // Progress Bar
    progress.total > 0 && React.createElement('div', {
      key: 'progress-section',
      style: {
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        marginBottom: '24px'
      }
    },
      React.createElement('div', { 
        key: 'progress-title',
        style: { 
          fontSize: '18px', 
          fontWeight: '600', 
          marginBottom: '16px',
          color: '#333'
        } 
      }, `📊 Tiến độ: ${progress.current}/${progress.total} links`),
      
      React.createElement('div', { 
        key: 'progress-bar-container',
        style: { 
          background: 'rgba(102, 126, 234, 0.1)',
          borderRadius: '12px',
          height: '12px',
          overflow: 'hidden',
          marginBottom: '16px'
        } 
      },
        React.createElement('div', {
          style: {
            height: '100%',
            width: `${(progress.current / progress.total * 100)}%`,
            background: progress.stage === 'done' 
              ? 'linear-gradient(90deg, #11998e 0%, #38ef7d 100%)'
              : progress.stage === 'error'
              ? 'linear-gradient(90deg, #eb3349 0%, #f45c43 100%)'
              : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '12px',
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: 'hidden'
          }
        },
          React.createElement('div', {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
              animation: 'shimmer 2s infinite'
            }
          })
        )
      ),
      
      React.createElement('div', { 
        key: 'progress-percentage',
        style: { 
          textAlign: 'center', 
          fontSize: '24px', 
          fontWeight: '700',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '12px'
        } 
      }, `${Math.round(progress.current / progress.total * 100)}%`),
      
      progress.currentLink && React.createElement('div', { 
        key: 'progress-link',
        style: { 
          fontSize: '13px', 
          color: '#666',
          marginBottom: '12px',
          wordBreak: 'break-all',
          padding: '8px 12px',
          background: 'rgba(102, 126, 234, 0.05)',
          borderRadius: '8px'
        } 
      }, '🔗 Link hiện tại: ', progress.currentLink),
      
      React.createElement('div', { 
        key: 'progress-stage',
        style: { 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '15px',
          fontWeight: '600',
          color: '#333',
          marginBottom: '8px',
          animation: progress.stage !== 'done' && progress.stage !== 'error' ? 'pulse 1.5s infinite' : 'none'
        } 
      },
        progress.stage === 'starting' && '🚀 Đang khởi động...',
        progress.stage === 'loading' && '⏳ Đang tải trang...',
        progress.stage === 'checking_captcha' && '🔍 Kiểm tra CAPTCHA...',
        progress.stage === 'solving_captcha' && '🧩 Đang giải CAPTCHA...',
        progress.stage === 'extracting' && '📊 Đang trích xuất dữ liệu...',
        progress.stage === 'done' && '✅ Hoàn thành!',
        progress.stage === 'error' && '❌ Lỗi'
      ),
      
      progress.message && React.createElement('div', { 
        key: 'progress-message',
        style: { 
          fontSize: '14px', 
          color: '#666',
          textAlign: 'center',
          fontStyle: 'italic'
        } 
      }, progress.message)
    ),

    // Thống kê - Professional Charts Section
    React.createElement('div', { key: 'stats', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' } }, [
      React.createElement('div', { 
        key: 'card1', 
        style: { 
          background: 'white', 
          borderRadius: 'var(--radius-xl)', 
          padding: 'var(--space-lg)', 
          border: '1px solid var(--color-gray-200)', 
          boxShadow: 'var(--shadow-sm)', 
          minHeight: 300,
          transition: 'box-shadow 0.3s ease'
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }
      }, [
        React.createElement('div', { 
          key: 'header', 
          style: { 
            display: 'flex', 
            alignItems: 'center', 
            gap: 'var(--space-sm)', 
            marginBottom: 'var(--space-md)',
            paddingBottom: 'var(--space-sm)',
            borderBottom: '1px solid var(--color-gray-200)'
          } 
        }, [
          React.createElement('span', { 
            key: 'icon', 
            style: { 
              fontSize: 20
            } 
          }, '📊'),
          React.createElement('h3', { 
            key: 't', 
            style: { 
              fontWeight: 600, 
              fontSize: 15,
              color: 'var(--color-gray-900)'
            } 
          }, 'Top Shop theo số sản phẩm')
        ]),
        React.createElement('div', { key: 'c', style: { position: 'relative', width: '100%', height: 240 } },
          React.createElement('canvas', { id: 'chart-topshops' })
        )
      ]),
      React.createElement('div', { 
        key: 'card2', 
        style: { 
          background: 'white', 
          borderRadius: 'var(--radius-xl)', 
          padding: 'var(--space-lg)', 
          border: '1px solid var(--color-gray-200)', 
          boxShadow: 'var(--shadow-sm)', 
          minHeight: 300,
          transition: 'box-shadow 0.3s ease'
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }
      }, [
        React.createElement('div', { 
          key: 'header', 
          style: { 
            display: 'flex', 
            alignItems: 'center', 
            gap: 'var(--space-sm)', 
            marginBottom: 'var(--space-md)',
            paddingBottom: 'var(--space-sm)',
            borderBottom: '1px solid var(--color-gray-200)'
          } 
        }, [
          React.createElement('span', { 
            key: 'icon', 
            style: { 
              fontSize: 20
            } 
          }, '🎯'),
          React.createElement('h3', { 
            key: 't', 
            style: { 
              fontWeight: 600, 
              fontSize: 15,
              color: 'var(--color-gray-900)'
            } 
          }, 'Phân bố trạng thái gần đây')
        ]),
        React.createElement('div', { key: 'c', style: { position: 'relative', width: '100%', height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          React.createElement('canvas', { id: 'chart-status' })
        )
      ])
    ]),

    // Note input + History controls
    React.createElement('div', { key: 'note-controls', style: { display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)', background: 'white', padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)' } }, [
      React.createElement(Input, { key: 'note', value: note, onChange: e => setNote(e.target.value), placeholder: 'Ghi chú cho lần crawl này (sẽ lưu kèm lịch sử)', style: { flex: 1 } }),
      React.createElement(Button, { key: 'reload-hist', variant: 'secondary', onClick: loadHistory, disabled: loadingHistory }, loadingHistory ? '⏳ Đang tải...' : '↻ Tải lịch sử')
    ]),

    // Results Table
    results.length > 0 && React.createElement('div', {
      key: 'results-section',
      style: {
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }
    },
      React.createElement('h3', { 
        key: 'results-title',
        style: { 
          marginBottom: '20px', 
          fontSize: '24px',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        } 
      }, '📈 Kết quả'),
      
      React.createElement('div', { 
        key: 'results-table',
        style: { overflowX: 'auto' } 
      },
        React.createElement('table', {
          style: {
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            background: 'white',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
          }
        },
          React.createElement('thead', null,
            React.createElement('tr', null,
              React.createElement('th', { 
                style: { 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '16px',
                  textAlign: 'left',
                  fontWeight: '600',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                } 
              }, 'Link'),
              React.createElement('th', { 
                style: { 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '16px',
                  textAlign: 'left',
                  fontWeight: '600',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                } 
              }, 'Shop'),
              React.createElement('th', { 
                style: { 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '16px',
                  textAlign: 'left',
                  fontWeight: '600',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                } 
              }, 'Đã bán (Shop)'),
              React.createElement('th', { 
                style: { 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '16px',
                  textAlign: 'left',
                  fontWeight: '600',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                } 
              }, 'Sản phẩm'),
              React.createElement('th', { 
                style: { 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '16px',
                  textAlign: 'left',
                  fontWeight: '600',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                } 
              }, 'Đã bán (SP)')
            )
          ),
          React.createElement('tbody', null,
            results.map((r, i) =>
              React.createElement('tr', {
                key: i,
                style: {
                  transition: 'all 0.2s ease',
                  borderBottom: i < results.length - 1 ? '1px solid #f0f0f0' : 'none'
                }
              },
                React.createElement('td', { 
                  style: { 
                    padding: '16px', 
                    fontSize: '13px',
                    color: '#666',
                    maxWidth: '260px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    position: 'relative'
                  },
                  onMouseEnter: () => setHoveredResultIndex(i),
                  onMouseLeave: () => setHoveredResultIndex(null)
                }, [
                  React.createElement('a', { key: 'a', href: r.url, target: '_blank', rel: 'noopener noreferrer', title: r.url, style: { color: '#2563eb', textDecoration: 'none', paddingRight: 28, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' } }, r.url),
                  React.createElement('button', { key: 'copy', onClick: () => copyToClipboard(r.url, `res-${i}`), title: 'Copy link',
                    style: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: '2px 6px', fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', opacity: hoveredResultIndex === i ? 1 : 0, transition: 'opacity 0.15s ease' }
                  }, copiedId === `res-${i}` ? '✅' : '📋')
                ]),
                React.createElement('td', { 
                  style: { 
                    padding: '16px', 
                    fontSize: '14px',
                    color: '#333',
                    fontWeight: '500'
                  } 
                }, r.error ? '—' : (r.shopName || '—')),
                React.createElement('td', { 
                  style: { 
                    padding: '16px', 
                    fontSize: '14px',
                    color: '#333'
                  } 
                }, r.error ? '—' : (r.shopSold || '—')),
                React.createElement('td', { 
                  style: { 
                    padding: '16px', 
                    fontSize: '14px',
                    color: '#333',
                    maxWidth: '300px'
                  } 
                }, r.error || r.message ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } }, [
                  React.createElement('span', { key: 'err', style: { color: '#c62828', fontStyle: 'italic', fontWeight: 600 } }, r.error || r.message || 'Lỗi'),
                  r.reason && React.createElement('span', { key: 'reason', style: { fontSize: 12, color: '#9ca3af' } }, `Lý do: ${r.reason}`),
                  r.suggestion && React.createElement('span', { key: 'sug', style: { fontSize: 12, color: '#f59e0b', marginTop: 4 } }, `💡 ${r.suggestion}`)
                ]) : (r.productName || '—')),
                React.createElement('td', { 
                  style: { 
                    padding: '16px', 
                    fontSize: '14px',
                    color: '#333'
                  } 
                }, r.error ? '—' : (r.productSold || '—'))
              )
            )
          )
        )
      )
    ),

    // AI Analysis Section
    Object.keys(shopCounts).length > 0 && React.createElement('div', {
      key: 'ai-analysis-section',
      style: {
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-lg)',
        marginTop: 'var(--space-lg)',
        marginBottom: 'var(--space-lg)',
        boxShadow: 'var(--shadow-md)',
        border: '2px solid var(--color-primary)'
      }
    }, [
      React.createElement('div', {
        key: 'header',
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-md)',
          paddingBottom: 'var(--space-sm)',
          borderBottom: '1px solid var(--color-gray-200)'
        }
      }, [
        React.createElement('span', { key: 'icon', style: { fontSize: 24 } }, '🤖'),
        React.createElement('h3', {
          key: 'title',
          style: {
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--color-gray-900)',
            flex: 1
          }
        }, 'Phân tích tăng trưởng với AI'),
        React.createElement(Badge, { key: 'ai-badge', variant: 'primary' }, 'DeepSeek AI')
      ]),
      
      React.createElement('div', { key: 'content', style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' } }, [
        // Progress bar
        analysisProgress && React.createElement('div', {
          key: 'progress-bar',
          style: {
            background: analysisProgress.startsWith('❌') ? '#fee2e2' : analysisProgress.startsWith('✅') ? '#dcfce7' : '#dbeafe',
            border: `1px solid ${analysisProgress.startsWith('❌') ? '#fecaca' : analysisProgress.startsWith('✅') ? '#bbf7d0' : '#bfdbfe'}`,
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-sm)',
            fontSize: '13px',
            fontWeight: '500',
            color: analysisProgress.startsWith('❌') ? '#991b1b' : analysisProgress.startsWith('✅') ? '#166534' : 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
            animation: 'fadeIn 0.3s ease-in'
          }
        }, [
          !analysisProgress.startsWith('✅') && !analysisProgress.startsWith('❌') && React.createElement('div', {
            key: 'spinner',
            style: {
              width: '14px',
              height: '14px',
              border: '2px solid var(--color-primary)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite'
            }
          }),
          React.createElement('span', { key: 'text' }, analysisProgress)
        ]),
        
        React.createElement('div', { key: 'api-key-row' },
          React.createElement('label', {
            style: {
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--color-gray-700)',
              marginBottom: 'var(--space-xs)'
            }
          }, 'DeepSeek API Key'),
          React.createElement('div', { style: { display: 'flex', gap: 'var(--space-sm)' } }, [
            React.createElement(Input, {
              key: 'api-input',
              value: deepseekApiKey,
              onChange: e => setDeepseekApiKey(e.target.value),
              placeholder: 'Nhập DeepSeek API key...',
              type: 'password',
              disabled: analyzingGrowth,
              style: { flex: 1 }
            }),
            deepseekApiKey && React.createElement(Button, {
              key: 'save-btn',
              onClick: () => {
                localStorage.setItem('deepseekApiKey', deepseekApiKey);
                alert('✅ API Key đã được lưu!');
              },
              variant: 'secondary'
            }, '💾 Lưu')
          ])
        ),
        
        React.createElement('div', { key: 'info-box', style: { background: '#dbeafe', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--color-gray-600)' } },
          '💡 Lấy API key miễn phí tại: ',
          React.createElement('a', { href: 'https://platform.deepseek.com', target: '_blank', style: { color: 'var(--color-primary)', textDecoration: 'underline', fontWeight: '500' } }, 'platform.deepseek.com')
        ),
        
        React.createElement('div', { key: 'shops-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-md)' } },
          Object.entries(shopCounts).map(([shopKey, count]) => {
            const shopName = history.find(h => (h.shopId || h.shopSlug || h.shopName) === shopKey)?.shopName || shopKey;
            const shopId = history.find(h => (h.shopId || h.shopSlug || h.shopName) === shopKey)?.shopId;
            
            return React.createElement('div', {
              key: shopKey,
              style: {
                background: 'var(--color-gray-50)',
                border: '1px solid var(--color-gray-200)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-sm)'
              }
            }, [
              React.createElement('div', { key: 'shop-info' }, [
                React.createElement('div', { key: 'name', style: { fontWeight: '600', fontSize: '14px', color: 'var(--color-gray-900)', marginBottom: '4px' } }, shopName),
                React.createElement('div', { key: 'count', style: { fontSize: '13px', color: 'var(--color-gray-500)' } }, `${count} sản phẩm`)
              ]),
              React.createElement(Button, {
                key: 'analyze-btn',
                onClick: () => handleAnalyzeGrowth(shopName, shopId),
                disabled: analyzingGrowth || !deepseekApiKey.trim(),
                variant: 'primary',
                style: { width: '100%', fontSize: '13px', padding: '8px 12px' }
              }, analyzingGrowth && selectedShopForAnalysis === shopName ? '⏳ Đang phân tích...' : '📊 Phân tích')
            ]);
          })
        ),
        
        analysisResult && React.createElement('div', {
          key: 'analysis-result',
          style: {
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            border: '2px solid var(--color-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-lg)',
            marginTop: 'var(--space-md)'
          }
        }, [
          React.createElement('div', {
            key: 'result-header',
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-md)',
              paddingBottom: 'var(--space-sm)',
              borderBottom: '1px solid var(--color-primary)'
            }
          }, [
            React.createElement('h4', {
              key: 'title',
              style: {
                fontSize: '16px',
                fontWeight: '700',
                color: 'var(--color-primary)'
              }
            }, `📈 Phân tích: ${analysisResult.shopInfo?.shopName || 'Shop'}`),
            React.createElement('button', {
              key: 'close',
              onClick: () => setAnalysisResult(null),
              style: {
                background: 'transparent',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: 'var(--color-gray-500)'
              }
            }, '×')
          ]),
          
          analysisResult.shopInfo && React.createElement('div', {
            key: 'shop-growth',
            style: {
              background: 'white',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-md)'
            }
          }, [
            React.createElement('h5', {
              key: 'title',
              style: { fontSize: '14px', fontWeight: '600', marginBottom: 'var(--space-sm)', color: 'var(--color-gray-900)' }
            }, '🏪 Tổng quan Shop'),
            React.createElement('div', { key: 'stats', style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-sm)', fontSize: '13px' } }, [
              React.createElement('div', { key: 'growth' }, [
                React.createElement('span', { style: { color: 'var(--color-gray-600)' } }, 'Tăng trưởng: '),
                React.createElement('span', { style: { fontWeight: '600', color: 'var(--color-success)' } }, `+${analysisResult.shopInfo.totalGrowth.toLocaleString()} (${analysisResult.shopInfo.growthRate})`)
              ]),
              React.createElement('div', { key: 'datapoints' }, [
                React.createElement('span', { style: { color: 'var(--color-gray-600)' } }, 'Lần theo dõi: '),
                React.createElement('span', { style: { fontWeight: '600' } }, analysisResult.shopInfo.dataPoints)
              ])
            ])
          ]),
          
          analysisResult.topProducts && analysisResult.topProducts.length > 0 && React.createElement('div', {
            key: 'top-products',
            style: {
              background: 'white',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-md)'
            }
          }, [
            React.createElement('h5', {
              key: 'title',
              style: { fontSize: '14px', fontWeight: '600', marginBottom: 'var(--space-sm)', color: 'var(--color-gray-900)' }
            }, '🔥 Top 10 sản phẩm tăng trưởng mạnh'),
            React.createElement('div', { key: 'products-list', style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' } },
              analysisResult.topProducts.map((prod, idx) =>
                React.createElement('div', {
                  key: idx,
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: 'var(--space-xs)',
                    background: idx % 2 === 0 ? 'var(--color-gray-50)' : 'transparent',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px'
                  }
                }, [
                  React.createElement('span', { key: 'name', style: { flex: 1, fontWeight: '500', color: 'var(--color-gray-900)' } }, `${idx + 1}. ${prod.name || prod.productName}`),
                  React.createElement('span', { key: 'growth', style: { fontWeight: '600', color: prod.totalGrowth >= 0 ? 'var(--color-success)' : '#ef4444' } }, `${prod.totalGrowth >= 0 ? '+' : ''}${prod.totalGrowth.toLocaleString()}`)
                ])
              )
            )
          ]),
          
          React.createElement('div', {
            key: 'ai-content',
            style: {
              background: 'white',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
              fontSize: '14px',
              lineHeight: '1.6',
              color: 'var(--color-gray-700)',
              whiteSpace: 'pre-wrap'
            }
          }, [
            React.createElement('h5', {
              key: 'title',
              style: { fontSize: '14px', fontWeight: '600', marginBottom: 'var(--space-sm)', color: 'var(--color-gray-900)' }
            }, '💬 Phân tích từ AI'),
            analysisResult.aiAnalysis
          ])
        ])
      ])
    ]),

    // History Table (with Group by Shop toggle)
    React.createElement('div', { key: 'hist', style: { marginTop: 20, background: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' } }, [
      React.createElement('div', { key: 'hist-head', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 } }, [
        React.createElement('h3', { key: 'h3', style: { margin: 0, fontSize: 20, fontWeight: 700, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } }, '🗂️ Lịch sử'),
        React.createElement('div', { key: 'right-controls', style: { display: 'flex', alignItems: 'center', gap: 12 } }, [
          React.createElement('label', { key: 'selall', style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' } }, [
            React.createElement('input', { type: 'checkbox', checked: history.length > 0 && selectedIds.length === history.length, onChange: toggleSelectAll }),
            React.createElement('span', null, 'Chọn tất cả')
          ]),
          React.createElement('label', { key: 'group-toggle', style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' } }, [
            React.createElement('input', { key: 'cb', type: 'checkbox', checked: groupByShop, onChange: e => handleToggleGroupByShop(e.target.checked) }),
            React.createElement('span', { key: 'lbl' }, 'Gộp theo Shop')
          ])
        ])
      ]),
      selectedIds.length > 0 && React.createElement('div', { key: 'bulkbar', style: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.08) 100%)', border: '1px solid #e5e7eb' } }, [
        React.createElement('span', { key: 'selcount', style: { fontWeight: 600, color: '#374151' } }, `${selectedIds.length} mục đã chọn`),
        React.createElement(Button, { key: 'bulkRecrawl', variant: 'secondary', onClick: handleBulkRecrawl }, '↻ Crawl lại đã chọn'),
        React.createElement(Button, { key: 'bulkDelete', variant: 'secondary', onClick: handleBulkDelete, style: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' } }, '🗑 Xóa đã chọn')
      ]),
      !groupByShop ? (
        React.createElement('div', { key: 'tbl', style: { overflowX: 'auto' } },
          React.createElement('table', { style: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' } }, [
            React.createElement('thead', { key: 'th' }, React.createElement('tr', null, [
              React.createElement('th', { key: 'sel-h', style: { width: 42, background: 'var(--color-primary)', color: '#fff', padding: 14, textAlign: 'center' } },
                React.createElement('input', { type: 'checkbox', checked: history.length > 0 && selectedIds.length === history.length, onChange: toggleSelectAll })
              ),
              'Link','Shop','Số SP','SP','Đã bán (Shop)','Đã bán (SP)','Thời gian','Note','Hành động'
            ].map((h, idx) => typeof h === 'string' ? React.createElement('th', { key: 'hh'+idx, style: { background: 'var(--color-primary)', color: '#fff', padding: 14, textAlign: 'left', fontSize: 13, fontWeight: '600', borderLeft: idx===0 ? 'none' : '1px solid rgba(255,255,255,0.2)' } }, h) : h))),
            React.createElement('tbody', { key: 'tb' }, history.map((it, idx) => React.createElement('tr', { key: it.id || idx, style: { background: idx % 2 === 0 ? '#fbfbff' : '#fff', transition: 'background 0.2s', borderBottom: '1px solid #f3f4f6' } }, [
              React.createElement('td', { style: { padding: 12, textAlign: 'center', borderRight: '1px solid #f3f4f6' } },
                React.createElement('input', { type: 'checkbox', checked: selectedIds.includes(it.id), onChange: () => toggleSelectOne(it.id) })
              ),
              React.createElement('td', { style: { position: 'relative', padding: 14, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#2563eb' },
                onMouseEnter: () => setHoveredHistoryId(it.id),
                onMouseLeave: () => setHoveredHistoryId(null)
              }, [
                React.createElement('a', { key: 'a', href: it.url, target: '_blank', rel: 'noopener noreferrer', title: it.url, style: { color: '#2563eb', textDecoration: 'none', paddingRight: 28, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' } }, it.url),
                React.createElement('button', { key: 'copy', onClick: () => copyToClipboard(it.url, it.id), title: 'Copy link', style: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: '2px 6px', fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', opacity: hoveredHistoryId === it.id ? 1 : 0, transition: 'opacity 0.15s ease' } }, copiedId === it.id ? '✅' : '📋')
              ]),
              React.createElement('td', { style: { padding: 14, borderLeft: '1px solid #f3f4f6' } }, it.shopName || '—'),
              React.createElement('td', { style: { padding: 14, borderLeft: '1px solid #f3f4f6', textAlign: 'center', color: '#111827', fontWeight: 600 } }, (() => { const k = it.shopId || it.shopSlug || it.shopName || 'unknown'; return shopCounts[k] || 1; })()),
              React.createElement('td', { style: { padding: 14, maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderLeft: '1px solid #f3f4f6' } }, it.productName || '—'),
              React.createElement('td', { style: { padding: 14, borderLeft: '1px solid #f3f4f6', textAlign: 'center' } }, it.shopSold || '—'),
              React.createElement('td', { style: { padding: 14, borderLeft: '1px solid #f3f4f6', textAlign: 'center' } }, it.productSold || '—'),
              React.createElement('td', { style: { padding: 14, borderLeft: '1px solid #f3f4f6', fontSize: 13, color: 'var(--color-gray-600)', whiteSpace: 'nowrap' }, title: it.createdAt }, formatTime(it.createdAt)),
              React.createElement('td', { style: { padding: 14, borderLeft: '1px solid #f3f4f6' } }, (
                editingId === it.id
                  ? React.createElement('input', { value: editingNote, onChange: e => setEditingNote(e.target.value), style: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', outline: 'none' } })
                  : (it.note || '')
              )),
              React.createElement('td', { style: { padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap', borderLeft: '1px solid #f3f4f6' } }, [
                React.createElement(Button, { key: 'rec'+idx, variant: 'secondary', onClick: () => handleRecrawlItem(it.url) }, '↻ Crawl lại'),
                editingId === it.id
                  ? React.createElement(Button, { key: 'save'+idx, variant: 'primary', onClick: () => handleSaveEdit(it) }, '💾 Lưu')
                  : React.createElement(Button, { key: 'edit'+idx, variant: 'secondary', onClick: () => handleStartEdit(it) }, '✏️ Sửa'),
                editingId === it.id
                  ? React.createElement(Button, { key: 'cancel'+idx, variant: 'secondary', onClick: handleCancelEdit, style: { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' } }, '✖ Hủy')
                  : null,
                React.createElement(Button, { key: 'del'+idx, variant: 'secondary', onClick: () => handleDeleteItem(it.id), style: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' } }, '🗑 Xóa')
              ])
            ])))
          ]))
      ) : (
        // Grouped view
        (() => {
          const groups = {};
          for (const it of history) {
            const key = it.shopId || it.shopSlug || it.shopName || 'unknown';
            if (!groups[key]) groups[key] = { key, shopId: it.shopId || null, shopSlug: it.shopSlug || null, shopName: it.shopName || it.shopSlug || 'Unknown Shop', items: [] };
            groups[key].items.push(it);
          }
          const groupArr = Object.values(groups).sort((a,b) => String(a.shopName).localeCompare(String(b.shopName)));
          const groupKeys = groupArr.map(g => g.key);
          return React.createElement('div', { key: 'groups', style: { display: 'flex', flexDirection: 'column', gap: 16 } }, [
            React.createElement('div', { key: 'toggles', style: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 8 } }, [
              React.createElement(Button, { key: 'collapseAll', variant: 'secondary', onClick: () => collapseAllGroups(groupKeys) }, 'Thu gọn tất cả'),
              React.createElement(Button, { key: 'expandAll', variant: 'secondary', onClick: () => expandAllGroups(groupKeys) }, 'Mở rộng tất cả')
            ]),
            ...groupArr.map((g, gi) => React.createElement('div', { key: g.key || gi, style: { border: '1px solid #e5e7eb', borderRadius: 12, background: 'white', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' } }, [
              React.createElement('div', { key: 'hdr', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'linear-gradient(135deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.08) 100%)', borderBottom: '1px solid #e5e7eb' } }, [
                React.createElement('div', { key: 'left', style: { display: 'flex', alignItems: 'center', gap: 10 } }, [
                  React.createElement('button', { key: 'toggle', onClick: () => setGroupCollapsed(g.key, !collapsedGroups[g.key]), title: collapsedGroups[g.key] ? 'Mở rộng' : 'Thu gọn', style: { border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, width: 28, height: 28, cursor: 'pointer' } }, collapsedGroups[g.key] ? '▶' : '▼'),
                  React.createElement('input', { key: 'selgrp', type: 'checkbox', checked: g.items.every(it => selectedIds.includes(it.id)), onChange: (e) => {
                    const allIds = g.items.map(it => it.id);
                    if (e.target.checked) {
                      setSelectedIds(prev => Array.from(new Set([...prev, ...allIds])));
                    } else {
                      setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
                    }
                  } }),
                  React.createElement('div', { key: 'title', style: { display: 'flex', alignItems: 'baseline', gap: 10 } }, [
                    React.createElement('span', { key: 'name', style: { fontWeight: 700, color: '#111827' } }, g.shopName),
                    React.createElement('span', { key: 'cnt', style: { fontSize: 12, color: '#6b7280' } }, `(${g.items.length} sản phẩm)`) 
                  ])
                ]),
                React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 8, alignItems: 'center' } }, [
                  React.createElement(Button, { 
                    key: 'shop', 
                    variant: 'secondary', 
                    onClick: () => handleCrawlShopOnly(g.key, g.items), 
                    disabled: shopOnlyResults[g.key]?.loading,
                    style: { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' } 
                  }, shopOnlyResults[g.key]?.loading ? '⏳ Đang crawl...' : '🏪 Crawl Shop'),
                  shopOnlyResults[g.key] && !shopOnlyResults[g.key].loading && (
                    shopOnlyResults[g.key].error 
                      ? React.createElement('span', { key: 'err', style: { fontSize: 13, color: '#ef4444', fontWeight: 500 } }, `❌ ${shopOnlyResults[g.key].error}`)
                      : React.createElement('div', { key: 'res', style: { display: 'flex', flexDirection: 'column', gap: 2 } }, [
                          React.createElement('div', { key: 'main', style: { fontSize: 13, color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 } }, [
                            React.createElement('span', { key: 'icon' }, '📦'),
                            React.createElement('span', { key: 'sold' }, `Tổng: ${shopOnlyResults[g.key].shopSold}`)
                          ]),
                          shopOnlyResults[g.key].growth && React.createElement('div', { key: 'growth', style: { fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 } }, [
                            React.createElement('span', { key: 'icon', style: { fontSize: 14 } }, shopOnlyResults[g.key].growth.diff >= 0 ? '📈' : '📉'),
                            React.createElement('span', { 
                              key: 'text', 
                              style: { color: shopOnlyResults[g.key].growth.diff >= 0 ? '#10b981' : '#ef4444' } 
                            }, `${shopOnlyResults[g.key].growth.diff >= 0 ? '+' : ''}${shopOnlyResults[g.key].growth.diff} (${shopOnlyResults[g.key].growth.percent >= 0 ? '+' : ''}${shopOnlyResults[g.key].growth.percent}%)`)
                          ])
                        ])
                  ),
                  React.createElement(Button, { key: 'recg', variant: 'secondary', onClick: () => handleRecrawlGroup(g.items) }, '↻ Crawl cả nhóm'),
                  React.createElement(Button, { key: 'delg', variant: 'secondary', onClick: () => handleDeleteGroup(g.items), style: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' } }, '🗑 Xóa nhóm')
                ])
              ]),
              !collapsedGroups[g.key] && React.createElement('div', { key: 'list', style: { overflowX: 'auto' } },
                React.createElement('table', { style: { width: '100%', borderCollapse: 'separate', borderSpacing: 0 } }, [
                  React.createElement('thead', { key: 'th' }, React.createElement('tr', null, ['Chọn','Link','Sản phẩm','Đã bán (Shop)','Đã bán (SP)','Thời gian','Note','Hành động'].map((h, idx) => React.createElement('th', { key: 'h'+idx, style: { background: 'var(--color-gray-100)', color: 'var(--color-gray-700)', padding: 12, textAlign: 'left', fontSize: 13, fontWeight: '600', borderBottom: '1px solid var(--color-gray-200)' } }, h)))),
                  React.createElement('tbody', { key: 'tb' }, g.items.map((it, idx) => React.createElement('tr', { key: it.id || idx, style: { borderBottom: '1px solid #f3f4f6' } }, [
                    React.createElement('td', { style: { padding: 12, textAlign: 'center' } },
                      React.createElement('input', { type: 'checkbox', checked: selectedIds.includes(it.id), onChange: () => toggleSelectOne(it.id) })
                    ),
                    React.createElement('td', { style: { position: 'relative', padding: 12, maxWidth: 360, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#2563eb' },
                      onMouseEnter: () => setHoveredHistoryId(it.id),
                      onMouseLeave: () => setHoveredHistoryId(null)
                    }, [
                      React.createElement('a', { key: 'a', href: it.url, target: '_blank', rel: 'noopener noreferrer', title: it.url, style: { color: '#2563eb', textDecoration: 'none', paddingRight: 28, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' } }, it.url),
                      React.createElement('button', { key: 'copy', onClick: () => copyToClipboard(it.url, it.id), title: 'Copy link', style: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: '2px 6px', fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', opacity: hoveredHistoryId === it.id ? 1 : 0, transition: 'opacity 0.15s ease' } }, copiedId === it.id ? '✅' : '📋')
                    ]),
                    React.createElement('td', { style: { padding: 12, maxWidth: 360, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, it.productName || '—'),
                    React.createElement('td', { style: { padding: 12, textAlign: 'center' } }, it.shopSold || '—'),
                    React.createElement('td', { style: { padding: 12, textAlign: 'center' } }, it.productSold || '—'),
                    React.createElement('td', { style: { padding: 12, fontSize: 13, color: 'var(--color-gray-600)', whiteSpace: 'nowrap' }, title: it.createdAt }, formatTime(it.createdAt)),
                    React.createElement('td', { style: { padding: 12 } }, (
                      editingId === it.id
                        ? React.createElement('input', { value: editingNote, onChange: e => setEditingNote(e.target.value), style: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', outline: 'none' } })
                        : (it.note || '')
                    )),
                    React.createElement('td', { style: { padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap' } }, [
                      React.createElement(Button, { key: 'rec'+idx, variant: 'secondary', onClick: () => handleRecrawlItem(it.url) }, '↻ Crawl lại'),
                      editingId === it.id
                        ? React.createElement(Button, { key: 'save'+idx, variant: 'primary', onClick: () => handleSaveEdit(it) }, '💾 Lưu')
                        : React.createElement(Button, { key: 'edit'+idx, variant: 'secondary', onClick: () => handleStartEdit(it) }, '✏️ Sửa'),
                      editingId === it.id
                        ? React.createElement(Button, { key: 'cancel'+idx, variant: 'secondary', onClick: handleCancelEdit, style: { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' } }, '✖ Hủy')
                        : null,
                      React.createElement(Button, { key: 'del'+idx, variant: 'secondary', onClick: () => handleDeleteItem(it.id), style: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' } }, '🗑 Xóa')
                    ])
                  ])))
                ]))
            ]))
          ]);
        })()
      )
    ])
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
