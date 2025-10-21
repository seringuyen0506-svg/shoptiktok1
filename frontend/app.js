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

  const Button = ({ children, onClick, disabled, variant = 'primary', style = {} }) => {
    const variants = {
      primary: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
      },
      secondary: {
        background: 'white',
        color: '#667eea',
        border: '2px solid #667eea'
      },
      success: {
        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        color: 'white',
        boxShadow: '0 4px 15px rgba(56, 239, 125, 0.4)'
      }
    };

    return React.createElement('button', {
      onClick,
      disabled,
      style: {
        padding: '14px 28px',
        border: 'none',
        borderRadius: '12px',
        fontSize: '15px',
        fontWeight: '600',
        fontFamily: 'Inter, sans-serif',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.3s ease',
        opacity: disabled ? 0.6 : 1,
        ...variants[variant],
        ...style
      }
    }, disabled && variant === 'primary' ? React.createElement('span', { className: 'spinner', style: { marginRight: '8px' } }) : null, children);
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
      const s = (it.status || '').toLowerCase();
      if (s.startsWith('success')) buckets.success++;
      else if (s.includes('cheerio')) buckets.cheerio++;
      else if (s.includes('geo')) buckets.geo++;
      else buckets.error++;
    }
    return buckets;
  }, [results, history]);

  useEffect(() => {
    // render charts when data changes; Chart.js loaded via index.html
    if (typeof Chart === 'undefined') return;
    // Top shops chart
    const ctx1 = document.getElementById('chart-topshops');
    if (ctx1) {
      if (ctx1._chart) ctx1._chart.destroy();
      ctx1._chart = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: topShops.map(s => s.name),
          datasets: [{
            label: 'Số sản phẩm',
            data: topShops.map(s => s.count),
            backgroundColor: 'rgba(102, 126, 234, 0.6)'
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }
    // Status distribution chart
    const ctx2 = document.getElementById('chart-status');
    if (ctx2) {
      if (ctx2._chart) ctx2._chart.destroy();
      ctx2._chart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: ['Thành công', 'Cheerio', 'Geo-block', 'Lỗi/Khác'],
          datasets: [{
            data: [statusDist.success, statusDist.cheerio, statusDist.geo, statusDist.error],
            backgroundColor: ['#34d399','#60a5fa','#fbbf24','#f87171']
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  }, [topShops, statusDist]);

  const Input = ({ value, onChange, placeholder, type = 'text', style = {} }) => {
    return React.createElement('input', {
      type,
      value,
      onChange,
      placeholder,
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
        ...style
      }
    });
  };

  const Badge = ({ children, variant = 'primary' }) => {
    const variants = {
      primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      success: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      error: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)'
    };

    return React.createElement('span', {
      style: {
        display: 'inline-block',
        padding: '6px 14px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: '600',
        background: variants[variant],
        color: 'white',
        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
      }
    }, children);
  };

  return React.createElement(
    'div',
    { style: { fontFamily: 'Inter, sans-serif' } },
    
    // Header
    React.createElement('div', { 
      style: { 
        textAlign: 'center', 
        marginBottom: '40px',
        paddingBottom: '30px',
        borderBottom: '2px solid #f0f0f0'
      }
    },
      React.createElement('h1', { 
        style: { 
          fontSize: '42px',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '8px',
          letterSpacing: '-1px'
        }
      }, '🚀 TikTok Shop Crawler Pro'),
      React.createElement('p', { 
        style: { 
          fontSize: '16px',
          color: '#666',
          fontWeight: '400'
        }
      }, 'Trích xuất dữ liệu TikTok Shop thông minh và nhanh chóng')
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

    // Thống kê
    React.createElement('div', { key: 'stats', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 } }, [
      React.createElement('div', { key: 'card1', style: { background: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: 16, border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', minHeight: 260 } }, [
        React.createElement('div', { key: 't', style: { fontWeight: 700, marginBottom: 8, color: '#374151' } }, 'Top Shop theo số sản phẩm'),
        React.createElement('div', { key: 'c', style: { position: 'relative', width: '100%', height: 220 } },
          React.createElement('canvas', { id: 'chart-topshops' })
        )
      ]),
      React.createElement('div', { key: 'card2', style: { background: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: 16, border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', minHeight: 260 } }, [
        React.createElement('div', { key: 't', style: { fontWeight: 700, marginBottom: 8, color: '#374151' } }, 'Phân bố trạng thái gần đây'),
        React.createElement('div', { key: 'c', style: { position: 'relative', width: '100%', height: 220 } },
          React.createElement('canvas', { id: 'chart-status' })
        )
      ])
    ]),

    // Note input + History controls
    React.createElement('div', { key: 'note-controls', style: { display: 'flex', gap: 12, marginBottom: 16 } }, [
      React.createElement(Input, { key: 'note', value: note, onChange: e => setNote(e.target.value), placeholder: 'Ghi chú cho lần crawl này (sẽ lưu kèm lịch sử)', style: { flex: 1 } }),
      React.createElement(Button, { key: 'reload-hist', variant: 'secondary', onClick: loadHistory }, '↻ Tải lịch sử')
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
              React.createElement('th', { key: 'sel-h', style: { width: 42, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', padding: 14, textAlign: 'center' } },
                React.createElement('input', { type: 'checkbox', checked: history.length > 0 && selectedIds.length === history.length, onChange: toggleSelectAll })
              ),
              'Link','Shop','Số SP','SP','Đã bán (Shop)','Đã bán (SP)','Note','Hành động'
            ].map((h, idx) => typeof h === 'string' ? React.createElement('th', { key: 'hh'+idx, style: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', padding: 14, textAlign: 'left', fontSize: 13, letterSpacing: '0.5px', borderLeft: idx===0 ? 'none' : '1px solid rgba(255,255,255,0.2)' } }, h) : h))),
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
              React.createElement('td', { style: { padding: 14, borderLeft: '1px solid #f3f4f6' } }, it.shopSold || '—'),
              React.createElement('td', { style: { padding: 14, borderLeft: '1px solid #f3f4f6' } }, it.productSold || '—'),
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
                React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 8 } }, [
                  React.createElement(Button, { key: 'recg', variant: 'secondary', onClick: () => handleRecrawlGroup(g.items) }, '↻ Crawl cả nhóm'),
                  React.createElement(Button, { key: 'delg', variant: 'secondary', onClick: () => handleDeleteGroup(g.items), style: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' } }, '🗑 Xóa nhóm')
                ])
              ]),
              !collapsedGroups[g.key] && React.createElement('div', { key: 'list', style: { overflowX: 'auto' } },
                React.createElement('table', { style: { width: '100%', borderCollapse: 'separate', borderSpacing: 0 } }, [
                  React.createElement('thead', { key: 'th' }, React.createElement('tr', null, ['Chọn','Link','Sản phẩm','Đã bán (SP)','Note','Hành động'].map((h, idx) => React.createElement('th', { key: 'h'+idx, style: { background: '#f9fafb', color: '#374151', padding: 12, textAlign: 'left', fontSize: 13, borderBottom: '1px solid #e5e7eb' } }, h)))),
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
                    React.createElement('td', { style: { padding: 12 } }, it.productSold || '—'),
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
