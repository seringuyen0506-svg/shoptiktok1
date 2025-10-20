#!/usr/bin/env node

/**
 * UNIFIED SERVER - Frontend + Backend Proxy
 * Chạy trên 1 port duy nhất để phù hợp với Cloudflare Tunnel
 */

const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Trust proxy for Cloudflare Tunnel
app.set('trust proxy', 1);

// CORS headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check - must come FIRST
app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

// API Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'TikTok Shop Crawler Unified Server'
  });
});

// Proxy ALL /api/* requests to backend
// NOTE: We mount at '/api', but Express strips the mount path from req.url (e.g., '/api/check-ip' -> '/check-ip').
// To keep backend route prefix '/api', we re-add it via pathRewrite below.
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:5000',
  changeOrigin: true,
  ws: true,
  logLevel: 'warn',
  // Re-add '/api' prefix that Express removed due to mount
  pathRewrite: (path, req) => `/api${path}`,
  onError: (err, req, res) => {
    console.error('❌ Backend proxy error:', err.message);
    if (res.headersSent) return;
    res.status(502).json({ 
      error: 'Backend không phản hồi. Kiểm tra backend server đang chạy.',
      details: err.message 
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    // After mount, req.url is '/check-ip'; we log the final target with '/api' re-added
    const finalPath = `/api${req.url}`;
    console.log(`→ Proxying: ${req.method} ${req.originalUrl} → http://localhost:5000${finalPath}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`← Backend response: ${proxyRes.statusCode} ${req.originalUrl}`);
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname)));

// SPA fallback - must come LAST
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 UNIFIED SERVER STARTED');
  console.log('='.repeat(60));
  console.log(`📡 Server:        http://localhost:${PORT}`);
  console.log(`🏥 Health:        http://localhost:${PORT}/health`);
  console.log(`🔗 API Proxy:     /api/* → http://localhost:5000/api/*`);
  console.log('='.repeat(60));
  console.log('\n✅ READY FOR CLOUDFLARE TUNNEL:');
  console.log(`   cloudflared tunnel --url http://localhost:${PORT}`);
  console.log('\n⚠️  IMPORTANT: Backend MUST be running on port 5000!');
  console.log('='.repeat(60) + '\n');
});
