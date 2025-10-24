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
  
  // Results table states (for Crawler tab results)
  const [selectedResultIds, setSelectedResultIds] = useState([]); // checkbox selection in results
  const [resultNotes, setResultNotes] = useState({}); // { index: 'note text' }
  const [editingResultIndex, setEditingResultIndex] = useState(null); // which result is being edited
  
  // Tab navigation state
  const [activeTab, setActiveTab] = useState('crawler'); // crawler, results
  
  // Dashboard states
  const [compactView, setCompactView] = useState(false);
  const [sortBy, setSortBy] = useState('updatedAt'); // updatedAt, shopSold, productGrowth, shopGrowth
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [filterGrowth, setFilterGrowth] = useState('all'); // all, positive, negative, none
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
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

  // Load notes from localStorage when results or history changes
  useEffect(() => {
    try {
      const allNotes = JSON.parse(localStorage.getItem('shopNotes') || '{}');
      const notesMap = {};
      
      // Load notes for results
      results.forEach((r, i) => {
        const noteKey = r.url || r.shopSlug || `note_${i}`;
        if (allNotes[noteKey]) {
          notesMap[i] = allNotes[noteKey];
        }
      });
      
      // Load notes for history
      history.forEach((h, i) => {
        const noteKey = h.url || h.shopSlug || `note_${i}`;
        if (allNotes[noteKey]) {
          notesMap[i] = allNotes[noteKey];
        }
      });
      
      setResultNotes(notesMap);
    } catch (e) {
      console.error('Failed to load notes:', e);
    }
  }, [results, history]);

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

  // Results table handlers
  const toggleSelectAllResults = () => {
    if (selectedResultIds.length === results.length) {
      setSelectedResultIds([]);
    } else {
      setSelectedResultIds(results.map((_, i) => i));
    }
  };

  const toggleSelectResult = (index) => {
    setSelectedResultIds(prev => 
      prev.includes(index) 
        ? prev.filter(id => id !== index)
        : [...prev, index]
    );
  };

  const handleSaveResultNote = (index) => {
    // Save to localStorage using shop URL or index as key
    const result = results[index] || history[index];
    if (result) {
      const noteKey = result.url || result.shopSlug || `note_${index}`;
      const allNotes = JSON.parse(localStorage.getItem('shopNotes') || '{}');
      allNotes[noteKey] = resultNotes[index] || '';
      localStorage.setItem('shopNotes', JSON.stringify(allNotes));
    }
    setEditingResultIndex(null);
    alert('✅ Ghi chú đã được lưu!');
  };

  const handleRecrawlSelected = async () => {
    const selectedUrls = selectedResultIds.map(i => results[i]?.url).filter(Boolean);
    if (selectedUrls.length === 0) {
      alert('⚠️ Vui lòng chọn ít nhất 1 item để crawl lại!');
      return;
    }
    
    if (confirm(`Bạn muốn crawl lại ${selectedUrls.length} link đã chọn?`)) {
      setSelectedResultIds([]); // Clear selection
      await handleCrawl(selectedUrls);
    }
  };

  const handleCrawlShopsOnly = async (shopUrls) => {
    console.log(`🏪 Crawling ${shopUrls.length} shop link(s)...`);
    
    setProgress({
      current: 0,
      total: shopUrls.length,
      currentLink: shopUrls[0] || '',
      stage: 'starting',
      message: 'Đang crawl shop...'
    });

    try {
      const shopResults = [];
      
      for (let i = 0; i < shopUrls.length; i++) {
        const url = shopUrls[i];
        setProgress(prev => ({
          ...prev,
          current: i + 1,
          currentLink: url,
          stage: 'extracting',
          message: `Đang crawl shop ${i + 1}/${shopUrls.length}...`
        }));

        try {
          const res = await fetch('/api/crawl-shop-only', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: url,
              apiKey: apiKey,
              note: note || 'Shop crawl'
            }),
            credentials: 'include'
          });

          const data = await res.json();

          if (res.ok && data.success) {
            shopResults.push({
              url: url,
              shopName: data.shopName || 'Unknown',
              shopSold: data.shopSold || '—',
              productName: '—',
              productSold: '—',
              status: 'success'
            });
          } else {
            shopResults.push({
              url: url,
              error: data.error || 'Failed to crawl shop',
              status: 'error'
            });
          }
        } catch (error) {
          shopResults.push({
            url: url,
            error: error.message,
            status: 'error'
          });
        }

        // Small delay between shops
        if (i < shopUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setResults(prev => [...prev, ...shopResults]);
      setProgress(prev => ({ ...prev, stage: 'done', message: 'Hoàn thành!' }));
      
      // Reload history to show updated data
      await loadHistory();
      
      alert(`✅ Đã crawl ${shopResults.filter(r => r.status === 'success').length}/${shopUrls.length} shop thành công!`);
    } catch (error) {
      console.error('❌ Error crawling shops:', error);
      setProgress(prev => ({ ...prev, stage: 'error', message: error.message }));
      alert(`❌ Lỗi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedResultIds.length === 0) {
      alert('⚠️ Vui lòng chọn ít nhất 1 item để xóa!');
      return;
    }
    
    if (confirm(`Xóa ${selectedResultIds.length} item đã chọn?`)) {
      const newResults = results.filter((_, i) => !selectedResultIds.includes(i));
      setResults(newResults);
      setSelectedResultIds([]);
      alert('✅ Đã xóa các item đã chọn!');
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
    
    // Detect shop links vs product links
    const isShopLink = (url) => {
      return /tiktok\.com\/shop\/store\//i.test(url);
    };
    
    const shopLinks = linkArray.filter(isShopLink);
    const productLinks = linkArray.filter(url => !isShopLink(url));
    
    // If all links are shop links, use different crawl method
    if (shopLinks.length > 0 && productLinks.length === 0) {
      console.log(`🏪 Detected ${shopLinks.length} shop link(s), using shop-only crawl`);
      await handleCrawlShopsOnly(shopLinks);
      return;
    }
    
    // If mixed, process separately
    if (shopLinks.length > 0) {
      console.log(`⚠️ Mixed links detected: ${shopLinks.length} shop, ${productLinks.length} product`);
      alert(`⚠️ Phát hiện ${shopLinks.length} link shop và ${productLinks.length} link sản phẩm.\nSẽ crawl riêng từng loại.`);
      
      // Crawl shops first
      await handleCrawlShopsOnly(shopLinks);
      
      // Then crawl products
      if (productLinks.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Small delay
        // Continue with product crawl below
      } else {
        setLoading(false);
        return;
      }
    }
    
    setProgress({
      current: 0,
      total: productLinks.length || linkArray.length,
      currentLink: (productLinks[0] || linkArray[0]) || '',
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
        
        const finalLinks = productLinks.length > 0 ? productLinks : linkArray;
        
        return {
          ...prev,
          current: newCurrent,
          currentLink: finalLinks[newCurrent] || prev.currentLink,
          stage: randomStage,
          message: `Đang xử lý link ${newCurrent}/${prev.total}...`
        };
      });
    }, 15000);

    try {
      const finalLinks = productLinks.length > 0 ? productLinks : linkArray;
      
      if (asyncMode) {
        // Fire-and-poll async job to avoid 524
        const startRes = await fetch('/api/crawl-async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ links: finalLinks, proxy, apiKey, note, concurrency }),
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
            total: jd.total || finalLinks.length,
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
        if (!finished) {
          clearInterval(progressInterval);
          throw new Error('Hết thời gian chờ job');
        }
      } else {
        // Create timeout signal (with fallback for older browsers)
        let timeoutSignal;
        try {
          timeoutSignal = AbortSignal.timeout(600000); // 10 minutes
        } catch (e) {
          // Fallback for browsers that don't support AbortSignal.timeout
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 600000);
          timeoutSignal = controller.signal;
        }
        
        const res = await fetch('/api/crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ links: linkArray, proxy, apiKey, note, concurrency }),
          credentials: 'include',
          signal: timeoutSignal
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
        
        const finalLinks = productLinks.length > 0 ? productLinks : linkArray;
        
        if (data.results) {
          setResults(prev => [...prev, ...data.results]);
          const successCount = data.results.filter(r => !r.error).length;
          setProgress({
            current: finalLinks.length,
            total: finalLinks.length,
            currentLink: '',
            stage: 'done',
            message: `✅ Hoàn thành! Thành công: ${successCount}/${finalLinks.length} links`
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

  const handleBulkCrawlShops = async () => {
    if (selectedIds.length === 0) {
      alert('⚠️ Vui lòng chọn ít nhất 1 shop!');
      return;
    }

    // Extract unique shop URLs from selected items
    const selectedItems = history.filter(h => selectedIds.includes(h.id));
    const shopUrlsMap = new Map();
    
    for (const item of selectedItems) {
      // Extract shop URL from product URL
      const shopUrl = item.url.match(/https:\/\/www\.tiktok\.com\/@[^/]+/)?.[0];
      if (shopUrl && !shopUrlsMap.has(shopUrl)) {
        shopUrlsMap.set(shopUrl, {
          url: shopUrl,
          shopName: item.shopName || item.shopSlug || 'Unknown'
        });
      }
    }

    const shopUrls = Array.from(shopUrlsMap.values());
    
    if (shopUrls.length === 0) {
      alert('❌ Không tìm thấy shop URL hợp lệ từ các mục đã chọn!');
      return;
    }

    if (!confirm(`🚀 Crawl ${shopUrls.length} shop(s) đã chọn?\n\n${shopUrls.map(s => s.shopName).join('\n')}`)) {
      return;
    }

    setShopCrawlProgress(`🔄 Đang crawl ${shopUrls.length} shop(s)...`);
    setCrawlingShop(true);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < shopUrls.length; i++) {
      const shop = shopUrls[i];
      setShopCrawlProgress(`🔍 [${i + 1}/${shopUrls.length}] Đang crawl: ${shop.shopName}...`);

      try {
        const res = await fetch('/api/crawl-shop-only', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: shop.url,
            apiKey: apiKey || undefined
          }),
          credentials: 'include'
        });

        const data = await res.json();

        if (res.ok && data.success) {
          successCount++;
          setShopCrawlProgress(`✅ [${i + 1}/${shopUrls.length}] ${shop.shopName}: ${data.data.shopSold} sold`);
        } else {
          errorCount++;
          console.error(`Error crawling ${shop.shopName}:`, data.error);
        }

        // Delay between requests to avoid rate limiting
        if (i < shopUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (e) {
        errorCount++;
        console.error(`Error crawling ${shop.shopName}:`, e.message);
      }
    }

    setCrawlingShop(false);
    setShopCrawlProgress(`🎉 Hoàn thành! ✅ ${successCount} shop | ❌ ${errorCount} lỗi`);
    
    // Reload history to show updated data
    await loadHistory();
    
    // Clear selection after crawl
    setSelectedIds([]);

    setTimeout(() => setShopCrawlProgress(''), 5000);
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

  // Helper function to parse sold numbers
  const parseSold = (str) => {
    if (!str) return null;
    const s = String(str).toLowerCase().replace(/[,\s]/g, '');
    if (s.includes('k')) {
      return parseFloat(s.replace('k', '')) * 1000;
    } else if (s.includes('m')) {
      return parseFloat(s.replace('m', '')) * 1000000;
    }
    const num = parseFloat(s);
    return isNaN(num) ? null : num;
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

  // ===== Filtered, Sorted, Paginated History =====
  const processedHistory = useMemo(() => {
    let filtered = [...history];
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(h => 
        (h.shopName || '').toLowerCase().includes(q) ||
        (h.productName || '').toLowerCase().includes(q) ||
        (h.url || '').toLowerCase().includes(q)
      );
    }
    
    // Growth filter
    if (filterGrowth !== 'all') {
      if (filterGrowth === 'positive') {
        filtered = filtered.filter(h => h.shopGrowth && h.shopGrowth.diff > 0);
      } else if (filterGrowth === 'negative') {
        filtered = filtered.filter(h => h.shopGrowth && h.shopGrowth.diff < 0);
      } else if (filterGrowth === 'none') {
        filtered = filtered.filter(h => !h.shopGrowth);
      }
    }
    
    // Sort
    filtered.sort((a, b) => {
      let valA, valB;
      
      if (sortBy === 'updatedAt') {
        valA = new Date(a.updatedAt || a.createdAt).getTime();
        valB = new Date(b.updatedAt || b.createdAt).getTime();
      } else if (sortBy === 'shopSold') {
        valA = parseSold(a.shopSold) || 0;
        valB = parseSold(b.shopSold) || 0;
      } else if (sortBy === 'shopGrowth') {
        valA = a.shopGrowth?.percent || -Infinity;
        valB = b.shopGrowth?.percent || -Infinity;
      } else if (sortBy === 'productGrowth') {
        valA = a.productGrowth?.percent || -Infinity;
        valB = b.productGrowth?.percent || -Infinity;
      }
      
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });
    
    return filtered;
  }, [history, searchQuery, filterGrowth, sortBy, sortOrder]);
  
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return processedHistory.slice(start, end);
  }, [processedHistory, currentPage, itemsPerPage]);
  
  const totalPages = Math.ceil(processedHistory.length / itemsPerPage);

  // ===== Stats (Charts) =====
  const topShops = useMemo(() => {
    // compute top 10 shops by total shopSold
    const byShop = {};
    for (const it of history) {
      const key = it.shopId || it.shopSlug || it.shopName || 'Unknown Shop';
      if (!byShop[key]) {
        byShop[key] = { 
          name: it.shopName || it.shopSlug || 'Unknown Shop', 
          totalSold: 0,
          lastShopSold: it.shopSold // Keep latest shopSold value
        };
      }
      // Update with latest shopSold (most recent crawl data)
      const sold = parseSold(it.shopSold);
      if (sold !== null && sold > byShop[key].totalSold) {
        byShop[key].totalSold = sold;
        byShop[key].lastShopSold = it.shopSold;
      }
    }
    return Object.values(byShop)
      .filter(s => s.totalSold > 0)
      .sort((a,b) => b.totalSold - a.totalSold)
      .slice(0, 10)
      .map(s => ({ name: s.name, count: s.totalSold })); // Use 'count' for chart compatibility
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

    // Tab Navigation
    React.createElement('div', {
      style: {
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: '8px',
        marginBottom: 'var(--space-lg)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--color-gray-200)',
        display: 'flex',
        gap: '8px'
      }
    }, [
      React.createElement('button', {
        key: 'tab-crawler',
        onClick: () => setActiveTab('crawler'),
        style: {
          flex: 1,
          padding: '14px 24px',
          borderRadius: 'var(--radius-lg)',
          border: 'none',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          background: activeTab === 'crawler' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f9fafb',
          color: activeTab === 'crawler' ? 'white' : '#6b7280',
          boxShadow: activeTab === 'crawler' ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'
        }
      }, '🚀 Crawler'),
      React.createElement('button', {
        key: 'tab-results',
        onClick: () => setActiveTab('results'),
        style: {
          flex: 1,
          padding: '14px 24px',
          borderRadius: 'var(--radius-lg)',
          border: 'none',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          background: activeTab === 'results' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f9fafb',
          color: activeTab === 'results' ? 'white' : '#6b7280',
          boxShadow: activeTab === 'results' ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'
        }
      }, '📊 Kết quả')
    ]),

    // Crawler Tab Content
    activeTab === 'crawler' && React.createElement(React.Fragment, null, [
    // Proxy Section - HIDDEN (use VPN extension in shared browser instead)
    /* React.createElement(GlassCard, { 
      key: 'proxy-card',
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
    }), */

    // Shared Browser Section (replaces Proxy + API Key - use extensions instead)
    React.createElement(GlassCard, {
      key: 'tiktok-login',
      children: [
        React.createElement('h3', {
          key: 'login-title',
          style: {
            marginBottom: '16px',
            fontSize: '18px',
            fontWeight: '600',
            color: '#333'
          }
        }, '🌐 Shared Browser (Login + Crawl)'),
        React.createElement('div', {
          key: 'login-desc',
          style: {
            marginBottom: '16px',
            padding: '12px 16px',
            background: '#e3f2fd',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#1565c0',
            lineHeight: '1.6'
          }
        }, [
          React.createElement('div', { key: 'd1', style: { fontWeight: 'bold', marginBottom: '8px' } }, '💡 Cách sử dụng:'),
          React.createElement('div', { key: 'd2' }, '1️⃣ Click "Mở Browser" → Browser sẽ mở (có UI)'),
          React.createElement('div', { key: 'd3' }, '2️⃣ Login TikTok + cài extensions (nếu cần)'),
          React.createElement('div', { key: 'd4' }, '3️⃣ Giữ browser mở → Tất cả crawl sẽ dùng browser này'),
          React.createElement('div', { key: 'd5', style: { marginTop: '8px', fontWeight: 'bold', color: '#d32f2f' } }, '⚠️ Bạn sẽ THẤY browser hoạt động real-time khi crawl!')
        ]),
        React.createElement('div', {
          key: 'login-buttons',
          style: { display: 'flex', gap: '12px', flexWrap: 'wrap' }
        },
          React.createElement(Button, {
            onClick: async () => {
              try {
                const res = await fetch('/api/open-shared-browser', {
                  method: 'POST',
                  credentials: 'include'
                });
                const data = await res.json();
                if (data.success) {
                  alert('✅ Browser đã mở!\n\n💡 Giờ bạn có thể:\n• Login TikTok\n• Cài Chrome extensions\n• Giữ browser mở\n\n🎯 Browser này sẽ dùng cho TẤT CẢ các lần crawl!');
                } else {
                  alert('❌ Lỗi: ' + (data.error || 'Không thể mở browser'));
                }
              } catch (e) {
                alert('❌ Lỗi kết nối: ' + e.message);
              }
            },
            variant: 'primary'
          }, '🌐 Mở Browser'),
          React.createElement(Button, {
            onClick: async () => {
              try {
                const res = await fetch('/api/close-shared-browser', {
                  method: 'POST',
                  credentials: 'include'
                });
                const data = await res.json();
                alert(data.message || 'Browser đã đóng');
              } catch (e) {
                alert('❌ Lỗi: ' + e.message);
              }
            },
            variant: 'secondary'
          }, '❌ Đóng Browser')
        )
      ]
    }),

    // API Key Section - HIDDEN (use CAPTCHA solver extension in shared browser instead)
    /* React.createElement(GlassCard, {
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
    }), */

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
        React.createElement('div', {
          key: 'bulk-info',
          style: {
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '12px',
            borderLeft: '4px solid #667eea',
            fontSize: '13px',
            color: '#4b5563'
          }
        }, '💡 Tối ưu cho crawl 50-100 link: Timeout 10 phút, xử lý 2-3 link đồng thời để tránh quá tải server'),
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
    }, [
      React.createElement('div', {
        key: 'results-header',
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }
      }, [
        React.createElement('h3', { 
          key: 'results-title',
          style: { 
            margin: 0,
            fontSize: '24px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          } 
        }, '📈 Kết quả'),
        
        // Bulk actions
        selectedResultIds.length > 0 && React.createElement('div', {
          key: 'bulk-actions',
          style: {
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            padding: '10px 16px',
            background: 'linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(102,126,234,0.2)'
          }
        }, [
          React.createElement('span', {
            key: 'count',
            style: {
              fontWeight: '600',
              color: '#667eea',
              fontSize: '14px'
            }
          }, `${selectedResultIds.length} đã chọn`),
          React.createElement(Button, {
            key: 'recrawl',
            variant: 'secondary',
            onClick: handleRecrawlSelected,
            style: {
              background: '#dbeafe',
              color: '#1e40af',
              border: '1px solid #93c5fd'
            }
          }, '↻ Crawl lại'),
          React.createElement(Button, {
            key: 'delete',
            variant: 'secondary',
            onClick: handleDeleteSelected,
            style: {
              background: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #fecaca'
            }
          }, '🗑 Xóa')
        ])
      ]),
      
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
            React.createElement('tr', null, [
              React.createElement('th', { 
                key: 'select-header',
                style: { 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '16px',
                  textAlign: 'center',
                  fontWeight: '600',
                  fontSize: '14px',
                  width: '50px'
                } 
              }, React.createElement('input', {
                type: 'checkbox',
                checked: results.length > 0 && selectedResultIds.length === results.length,
                onChange: toggleSelectAllResults,
                style: { cursor: 'pointer', width: '16px', height: '16px' }
              })),
              React.createElement('th', { 
                key: 'link',
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
                key: 'shop',
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
                key: 'note',
                style: { 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '16px',
                  textAlign: 'left',
                  fontWeight: '600',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  minWidth: '200px'
                } 
              }, 'Note'),
              React.createElement('th', { 
                key: 'shop-sold',
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
                key: 'product',
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
                key: 'product-sold',
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
            ])
          ),
          React.createElement('tbody', null,
            results.map((r, i) =>
              React.createElement('tr', {
                key: i,
                style: {
                  transition: 'all 0.2s ease',
                  borderBottom: i < results.length - 1 ? '1px solid #f0f0f0' : 'none',
                  background: selectedResultIds.includes(i) ? '#f0f4ff' : (i % 2 === 0 ? 'white' : '#f9fafb')
                }
              }, [
                // Checkbox column
                React.createElement('td', { 
                  key: 'select',
                  style: { 
                    padding: '16px', 
                    textAlign: 'center'
                  } 
                }, React.createElement('input', {
                  type: 'checkbox',
                  checked: selectedResultIds.includes(i),
                  onChange: () => toggleSelectResult(i),
                  style: { cursor: 'pointer', width: '16px', height: '16px' }
                })),
                
                // Link column
                React.createElement('td', { 
                  key: 'link',
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
                
                // Shop column
                React.createElement('td', { 
                  key: 'shop',
                  style: { 
                    padding: '16px', 
                    fontSize: '14px',
                    color: '#333',
                    fontWeight: '500'
                  } 
                }, r.error ? '—' : (r.shopName || '—')),
                
                // Note column
                React.createElement('td', { 
                  key: 'note',
                  style: { 
                    padding: '16px', 
                    fontSize: '14px',
                    color: '#333',
                    minWidth: '200px'
                  } 
                }, editingResultIndex === i 
                  ? React.createElement('div', {
                      style: {
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center'
                      }
                    }, [
                      React.createElement('input', {
                        key: 'input',
                        type: 'text',
                        value: resultNotes[i] || '',
                        onChange: (e) => setResultNotes(prev => ({ ...prev, [i]: e.target.value })),
                        placeholder: 'Nhập ghi chú...',
                        style: {
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          fontSize: '13px',
                          outline: 'none'
                        }
                      }),
                      React.createElement('button', {
                        key: 'save',
                        onClick: () => handleSaveResultNote(i),
                        style: {
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#10b981',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }
                      }, '💾 Lưu'),
                      React.createElement('button', {
                        key: 'cancel',
                        onClick: () => setEditingResultIndex(null),
                        style: {
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                          background: 'white',
                          color: '#666',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }
                      }, '✖')
                    ])
                  : React.createElement('div', {
                      style: {
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center'
                      }
                    }, [
                      React.createElement('span', {
                        key: 'text',
                        style: {
                          flex: 1,
                          color: resultNotes[i] ? '#333' : '#9ca3af',
                          fontStyle: resultNotes[i] ? 'normal' : 'italic'
                        }
                      }, resultNotes[i] || 'Chưa có ghi chú'),
                      React.createElement('button', {
                        key: 'edit',
                        onClick: () => setEditingResultIndex(i),
                        style: {
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                          background: 'white',
                          color: '#667eea',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }
                      }, '✏️ Sửa')
                    ])
                ),
                
                // Shop Sold column
                React.createElement('td', { 
                  key: 'shop-sold',
                  style: { 
                    padding: '16px', 
                    fontSize: '14px',
                    color: '#333'
                  } 
                }, r.error ? '—' : (r.shopSold || '—')),
                
                // Product column
                React.createElement('td', { 
                  key: 'product',
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
                
                // Product Sold column
                React.createElement('td', { 
                  key: 'product-sold',
                  style: { 
                    padding: '16px', 
                    fontSize: '14px',
                    color: '#333'
                  } 
                }, r.error ? '—' : (r.productSold || '—'))
              ])
            )
          )
        )
      )
    ]),

    ]), // End Crawler Tab

    // Results Tab Content  
    activeTab === 'results' && React.createElement(React.Fragment, null, [
    // Dashboard Overview Section
    history.length > 0 && React.createElement('div', { key: 'dashboard', style: { marginTop: 20, background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' } }, [
      React.createElement('h3', { key: 'title', style: { margin: '0 0 20px 0', fontSize: 22, fontWeight: 700, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } }, '📊 Tổng quan'),
      
      // Key Metrics Cards
      React.createElement('div', { key: 'metrics', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 } }, [
        // Total Shops
        React.createElement('div', { key: 'shops', style: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 12, padding: 16, color: 'white' } }, [
          React.createElement('div', { key: 'icon', style: { fontSize: 32, marginBottom: 8 } }, '🏪'),
          React.createElement('div', { key: 'val', style: { fontSize: 28, fontWeight: 700 } }, Object.keys(shopCounts).length),
          React.createElement('div', { key: 'lbl', style: { fontSize: 13, opacity: 0.9 } }, 'Tổng số Shop')
        ]),
        
        // Total Products
        React.createElement('div', { key: 'products', style: { background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', borderRadius: 12, padding: 16, color: 'white' } }, [
          React.createElement('div', { key: 'icon', style: { fontSize: 32, marginBottom: 8 } }, '📦'),
          React.createElement('div', { key: 'val', style: { fontSize: 28, fontWeight: 700 } }, history.length),
          React.createElement('div', { key: 'lbl', style: { fontSize: 13, opacity: 0.9 } }, 'Tổng sản phẩm')
        ]),
        
        // Best Shop Growth
        React.createElement('div', { key: 'best', style: { background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', borderRadius: 12, padding: 16, color: 'white' } }, [
          React.createElement('div', { key: 'icon', style: { fontSize: 32, marginBottom: 8 } }, '📈'),
          React.createElement('div', { key: 'val', style: { fontSize: 28, fontWeight: 700 } }, (() => {
            const withGrowth = history.filter(h => h.shopGrowth && h.shopGrowth.percent);
            if (withGrowth.length === 0) return '—';
            const best = withGrowth.reduce((max, h) => h.shopGrowth.percent > max ? h.shopGrowth.percent : max, -Infinity);
            return best > 0 ? `+${best.toFixed(1)}%` : '—';
          })()),
          React.createElement('div', { key: 'lbl', style: { fontSize: 13, opacity: 0.9 } }, 'Shop tăng mạnh nhất')
        ]),
        
        // Shops with Positive Growth
        React.createElement('div', { key: 'positive', style: { background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', borderRadius: 12, padding: 16, color: 'white' } }, [
          React.createElement('div', { key: 'icon', style: { fontSize: 32, marginBottom: 8 } }, '✅'),
          React.createElement('div', { key: 'val', style: { fontSize: 28, fontWeight: 700 } }, (() => {
            const withGrowth = history.filter(h => h.shopGrowth && h.shopGrowth.diff > 0);
            return withGrowth.length;
          })()),
          React.createElement('div', { key: 'lbl', style: { fontSize: 13, opacity: 0.9 } }, 'Shop đang tăng trưởng')
        ])
      ]),
      
      // Filter and Sort Controls
      React.createElement('div', { key: 'controls', style: { display: 'flex', flexWrap: 'wrap', gap: 12, padding: 16, background: '#f9fafb', borderRadius: 12, alignItems: 'center' } }, [
        // Search
        React.createElement('div', { key: 'search', style: { flex: '1 1 250px', position: 'relative', display: 'flex', gap: 8 } }, [
          React.createElement('input', {
            type: 'text',
            placeholder: '🔍 Tìm shop...',
            value: searchQuery,
            onChange: e => setSearchQuery(e.target.value),
            onKeyPress: e => { if (e.key === 'Enter') setCurrentPage(1); },
            style: { flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }
          }),
          React.createElement('button', {
            key: 'search-btn',
            onClick: () => setCurrentPage(1),
            style: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#667eea', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }
          }, '🔍 Tìm kiếm'),
          searchQuery && React.createElement('button', {
            key: 'clear',
            onClick: () => { setSearchQuery(''); setCurrentPage(1); },
            style: { padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 14, color: '#9ca3af' }
          }, '✖')
        ]),
        
        // Filter Growth
        React.createElement('select', {
          key: 'filter-growth',
          value: filterGrowth,
          onChange: e => { setFilterGrowth(e.target.value); setCurrentPage(1); },
          style: { padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, background: 'white', cursor: 'pointer' }
        }, [
          React.createElement('option', { value: 'all' }, 'Tất cả tăng trưởng'),
          React.createElement('option', { value: 'positive' }, '📈 Chỉ shop tăng'),
          React.createElement('option', { value: 'negative' }, '📉 Chỉ shop giảm'),
          React.createElement('option', { value: 'none' }, '— Chưa có data')
        ]),
        
        // Sort By
        React.createElement('select', {
          key: 'sort-by',
          value: sortBy,
          onChange: e => setSortBy(e.target.value),
          style: { padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, background: 'white', cursor: 'pointer' }
        }, [
          React.createElement('option', { value: 'updatedAt' }, 'Sắp xếp: Thời gian'),
          React.createElement('option', { value: 'shopSold' }, 'Sắp xếp: Đã bán Shop'),
          React.createElement('option', { value: 'shopGrowth' }, 'Sắp xếp: Tăng trưởng Shop'),
          React.createElement('option', { value: 'productGrowth' }, 'Sắp xếp: Tăng trưởng SP')
        ]),
        
        // Sort Order
        React.createElement('button', {
          key: 'sort-order',
          onClick: () => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'),
          style: { padding: '10px 16px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, background: 'white', cursor: 'pointer', fontWeight: 600 }
        }, sortOrder === 'desc' ? '⬇ Giảm dần' : '⬆ Tăng dần'),
        
        // View Mode Toggle
        React.createElement('button', {
          key: 'view-mode',
          onClick: () => setCompactView(prev => !prev),
          style: { padding: '10px 16px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, background: compactView ? '#667eea' : 'white', color: compactView ? 'white' : '#374151', cursor: 'pointer', fontWeight: 600 }
        }, compactView ? '📋 Chế độ gọn' : '📄 Chế độ chi tiết'),
        
        // Items per page
        React.createElement('select', {
          key: 'per-page',
          value: itemsPerPage,
          onChange: e => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); },
          style: { padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, background: 'white', cursor: 'pointer' }
        }, [
          React.createElement('option', { value: 20 }, '20 / trang'),
          React.createElement('option', { value: 50 }, '50 / trang'),
          React.createElement('option', { value: 100 }, '100 / trang')
        ])
      ])
    ]),

    // Time-Series Crawl Results Table (like reference image)
    history.length > 0 && React.createElement('div', { key: 'timeseries', style: { marginTop: 20, background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' } }, [
      React.createElement('div', { key: 'header', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 } }, [
        React.createElement('h3', { key: 'title', style: { margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' } }, '📊 Kết quả Crawl theo Store'),
        React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 8 } }, [
          React.createElement('button', { 
            key: 'json',
            onClick: () => {
              const dataStr = JSON.stringify(history, null, 2);
              const blob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `crawl-data-${new Date().toISOString().slice(0,10)}.json`;
              a.click();
            },
            style: { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13 }
          }, '⬇ Export JSON'),
          React.createElement('button', { 
            key: 'excel',
            onClick: () => alert('Excel export coming soon!'),
            style: { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13 }
          }, '⬇ Excel M3')
        ])
      ]),
      
      // Bulk actions bar
      selectedResultIds.length > 0 && React.createElement('div', {
        key: 'bulk-actions-bar',
        style: {
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          padding: '12px 20px',
          marginBottom: '16px',
          background: 'linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(102,126,234,0.2)'
        }
      }, [
        React.createElement('span', {
          key: 'count',
          style: {
            fontWeight: '600',
            color: '#667eea',
            fontSize: '14px'
          }
        }, `${selectedResultIds.length} shop đã chọn`),
        React.createElement(Button, {
          key: 'recrawl',
          variant: 'secondary',
          onClick: handleRecrawlSelected,
          style: {
            background: '#dbeafe',
            color: '#1e40af',
            border: '1px solid #93c5fd'
          }
        }, '↻ Crawl lại'),
        React.createElement(Button, {
          key: 'delete',
          variant: 'secondary',
          onClick: handleDeleteSelected,
          style: {
            background: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fecaca'
          }
        }, '🗑 Xóa')
      ]),
      
      (() => {
        // Build time-series data: { shopKey: { name, url, dates: { '2025-10-23': { sold, growth } } } }
        const shopData = {};
        const allDates = new Set();
        
        for (const it of history) {
          const shopKey = it.shopId || it.shopSlug || it.shopName || 'Unknown';
          const date = (it.updatedAt || it.createdAt).slice(0, 10); // YYYY-MM-DD
          
          if (!shopData[shopKey]) {
            shopData[shopKey] = {
              name: it.shopName || it.shopSlug || 'Unknown Shop',
              url: it.url,
              dates: {}
            };
          }
          
          allDates.add(date);
          
          // Keep latest data for each date
          if (!shopData[shopKey].dates[date] || new Date(it.updatedAt || it.createdAt) > new Date(shopData[shopKey].dates[date].timestamp)) {
            const sold = parseSold(it.shopSold);
            shopData[shopKey].dates[date] = {
              sold: sold,
              soldText: it.shopSold || '—',
              growth: null, // Will calculate later
              timestamp: it.updatedAt || it.createdAt
            };
          }
        }
        
        const sortedDates = Array.from(allDates).sort();
        
        // Calculate growth for each shop across dates
        Object.values(shopData).forEach(shop => {
          let previousSold = null;
          sortedDates.forEach(date => {
            const dayData = shop.dates[date];
            if (dayData && dayData.sold !== null) {
              if (previousSold !== null && previousSold > 0) {
                const diff = dayData.sold - previousSold;
                const percent = ((diff / previousSold) * 100).toFixed(1);
                dayData.growth = {
                  diff: diff,
                  percent: parseFloat(percent)
                };
              }
              previousSold = dayData.sold;
            }
          });
        });
        
        const shops = Object.values(shopData).sort((a, b) => a.name.localeCompare(b.name));
        
        return React.createElement('div', { 
          key: 'table-wrapper', 
          style: { 
            position: 'relative',
            border: '1px solid #e5e7eb', 
            borderRadius: 12, 
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          } 
        }, [
          // Scrollable container
          React.createElement('div', { 
            key: 'table-container', 
            style: { 
              overflowX: 'auto',
              overflowY: 'visible',
              maxHeight: '600px',
              // Custom scrollbar styling
              scrollbarWidth: 'thin',
              scrollbarColor: '#667eea #f1f5f9'
            },
            // Add custom scrollbar for webkit browsers
            ref: (el) => {
              if (el) {
                const style = document.createElement('style');
                style.textContent = `
                  div[data-scrollbar="custom"]::-webkit-scrollbar {
                    height: 12px;
                  }
                  div[data-scrollbar="custom"]::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 6px;
                  }
                  div[data-scrollbar="custom"]::-webkit-scrollbar-thumb {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 6px;
                  }
                  div[data-scrollbar="custom"]::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(135deg, #5568d3 0%, #6a4190 100%);
                  }
                `;
                if (!document.getElementById('custom-scrollbar-style')) {
                  style.id = 'custom-scrollbar-style';
                  document.head.appendChild(style);
                }
                el.setAttribute('data-scrollbar', 'custom');
              }
            }
          },
          React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'white', minWidth: '800px' } }, [
            // Header
            React.createElement('thead', { key: 'thead' }, React.createElement('tr', { style: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' } }, [
              React.createElement('th', { 
                key: 'checkbox', 
                style: { 
                  padding: '14px 16px', 
                  textAlign: 'center', 
                  fontWeight: 700, 
                  fontSize: 14, 
                  position: 'sticky', 
                  left: 0, 
                  background: '#667eea', 
                  zIndex: 10, 
                  borderRight: '1px solid rgba(255,255,255,0.2)',
                  width: '50px'
                } 
              }, React.createElement('input', {
                type: 'checkbox',
                checked: history.length > 0 && selectedResultIds.length === history.length,
                onChange: toggleSelectAllResults,
                style: { cursor: 'pointer', width: '16px', height: '16px' }
              })),
              React.createElement('th', { key: 'name', style: { padding: '14px 20px', textAlign: 'left', fontWeight: 700, fontSize: 14, position: 'sticky', left: 50, background: '#667eea', zIndex: 10, borderRight: '1px solid rgba(255,255,255,0.2)' } }, 'Store Name'),
              React.createElement('th', { key: 'note', style: { padding: '14px 20px', textAlign: 'left', fontWeight: 700, fontSize: 14, minWidth: 200, borderRight: '1px solid rgba(255,255,255,0.2)' } }, 'Note'),
              React.createElement('th', { key: 'url', style: { padding: '14px 20px', textAlign: 'left', fontWeight: 700, fontSize: 14, minWidth: 250, borderRight: '1px solid rgba(255,255,255,0.2)' } }, 'Store URL'),
              ...sortedDates.map((date, idx) => {
                // Convert YYYY-MM-DD to DD/MM/YYYY
                const [year, month, day] = date.split('-');
                const formattedDate = `${day}/${month}/${year}`;
                
                return React.createElement('th', { 
                  key: `date-${idx}`, 
                  style: { 
                    padding: '14px 20px', 
                    textAlign: 'center', 
                    fontWeight: 700, 
                    fontSize: 14,
                    minWidth: 120, 
                    whiteSpace: 'nowrap',
                    borderRight: idx < sortedDates.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none'
                  } 
                }, formattedDate); // DD/MM/YYYY
              })
            ])),
            
            // Body
            React.createElement('tbody', { key: 'tbody' }, shops.map((shop, shopIdx) =>
              React.createElement('tr', { 
                key: `shop-${shopIdx}`, 
                style: { 
                  background: selectedResultIds.includes(shopIdx) ? '#f0f4ff' : (shopIdx % 2 === 0 ? 'white' : '#f9fafb'),
                  borderBottom: shopIdx < shops.length - 1 ? '1px solid #e5e7eb' : 'none',
                  transition: 'background 0.15s, box-shadow 0.15s',
                  cursor: 'default'
                },
                onMouseEnter: (e) => {
                  if (!selectedResultIds.includes(shopIdx)) {
                    e.currentTarget.style.background = '#f0f4ff';
                  }
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.15)';
                },
                onMouseLeave: (e) => {
                  if (!selectedResultIds.includes(shopIdx)) {
                    e.currentTarget.style.background = shopIdx % 2 === 0 ? 'white' : '#f9fafb';
                  }
                  e.currentTarget.style.boxShadow = 'none';
                }
              }, [
                // Checkbox cell
                React.createElement('td', { 
                  key: 'checkbox', 
                  style: { 
                    padding: '14px 16px', 
                    textAlign: 'center',
                    position: 'sticky',
                    left: 0,
                    background: 'inherit',
                    zIndex: 5,
                    borderRight: '1px solid #e5e7eb'
                  } 
                }, React.createElement('input', {
                  type: 'checkbox',
                  checked: selectedResultIds.includes(shopIdx),
                  onChange: () => toggleSelectResult(shopIdx),
                  style: { cursor: 'pointer', width: '16px', height: '16px' }
                })),
                
                // Store Name cell
                React.createElement('td', { 
                  key: 'name', 
                  style: { 
                    padding: '14px 20px', 
                    fontWeight: 700, 
                    color: '#111827',
                    fontSize: 14,
                    position: 'sticky',
                    left: 50,
                    background: 'inherit',
                    zIndex: 5,
                    borderRight: '1px solid #e5e7eb'
                  } 
                }, shop.name),
                
                // Note cell
                React.createElement('td', { 
                  key: 'note', 
                  style: { 
                    padding: '14px 20px',
                    minWidth: 200,
                    borderRight: '1px solid #e5e7eb'
                  } 
                }, editingResultIndex === shopIdx 
                  ? React.createElement('div', {
                      style: {
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center'
                      }
                    }, [
                      React.createElement('input', {
                        key: 'input',
                        type: 'text',
                        value: resultNotes[shopIdx] || '',
                        onChange: (e) => setResultNotes(prev => ({ ...prev, [shopIdx]: e.target.value })),
                        placeholder: 'Nhập ghi chú...',
                        style: {
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '13px',
                          outline: 'none'
                        }
                      }),
                      React.createElement('button', {
                        key: 'save',
                        onClick: () => handleSaveResultNote(shopIdx),
                        style: {
                          padding: '5px 10px',
                          borderRadius: '4px',
                          border: 'none',
                          background: '#10b981',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }
                      }, '💾 Lưu'),
                      React.createElement('button', {
                        key: 'cancel',
                        onClick: () => setEditingResultIndex(null),
                        style: {
                          padding: '5px 10px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          background: 'white',
                          color: '#666',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }
                      }, '✖')
                    ])
                  : React.createElement('div', {
                      style: {
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center'
                      }
                    }, [
                      React.createElement('span', {
                        key: 'text',
                        style: {
                          flex: 1,
                          color: resultNotes[shopIdx] ? '#111827' : '#9ca3af',
                          fontStyle: resultNotes[shopIdx] ? 'normal' : 'italic',
                          fontSize: '13px'
                        }
                      }, resultNotes[shopIdx] || 'Chưa có ghi chú'),
                      React.createElement('button', {
                        key: 'edit',
                        onClick: () => setEditingResultIndex(shopIdx),
                        style: {
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          background: 'white',
                          color: '#667eea',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }
                      }, '✏️ Sửa')
                    ])
                ),
                
                // Store URL cell
                React.createElement('td', { 
                  key: 'url', 
                  style: { 
                    padding: '14px 20px', 
                    maxWidth: 250, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    borderRight: '1px solid #e5e7eb'
                  } 
                }, React.createElement('a', { href: shop.url, target: '_blank', style: { color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }, title: shop.url }, shop.url)),
                ...sortedDates.map((date, dateIdx) => {
                  const dayData = shop.dates[date];
                  if (!dayData) {
                    return React.createElement('td', { 
                      key: `cell-${dateIdx}`, 
                      style: { 
                        padding: '14px 20px', 
                        textAlign: 'center', 
                        color: '#d1d5db',
                        fontSize: 16,
                        borderRight: dateIdx < sortedDates.length - 1 ? '1px solid #e5e7eb' : 'none'
                      } 
                    }, '—');
                  }
                  
                  return React.createElement('td', { 
                    key: `cell-${dateIdx}`, 
                    style: { 
                      padding: '14px 20px', 
                      textAlign: 'center',
                      borderRight: dateIdx < sortedDates.length - 1 ? '1px solid #e5e7eb' : 'none'
                    } 
                  }, [
                    React.createElement('div', { 
                      key: 'sold', 
                      style: { 
                        fontWeight: 700, 
                        color: '#111827', 
                        fontSize: 14, 
                        marginBottom: dayData.growth ? 6 : 0 
                      } 
                    }, dayData.soldText),
                    dayData.growth && React.createElement('div', { 
                      key: 'growth', 
                      style: { 
                        fontSize: 11, 
                        color: dayData.growth.diff >= 0 ? '#10b981' : '#ef4444',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: dayData.growth.diff >= 0 ? '#d1fae5' : '#fee2e2',
                        display: 'inline-block'
                      } 
                    }, `${dayData.growth.diff >= 0 ? '+' : ''}${dayData.growth.diff >= 1000 ? (dayData.growth.diff/1000).toFixed(1)+'K' : dayData.growth.diff} (${dayData.growth.diff >= 0 ? '+' : ''}${dayData.growth.percent}%)`)
                  ]);
                })
              ])
            ))
          ])
          )
        ]);
      })()
    ]),
    ]), // End Results Tab

    // End Results Tab
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
