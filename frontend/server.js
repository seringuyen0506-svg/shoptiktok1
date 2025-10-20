const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Trust proxy for Cloudflare Tunnel
app.set('trust proxy', 1);

// Health check - must come before static files
app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

// Proxy API requests to backend
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:5000',
  changeOrigin: true,
  ws: true,
  logLevel: 'error',
  onError: (err, req, res) => {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: 'Backend connection failed' });
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname)));

// SPA fallback - must come last
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Frontend server running at http://localhost:${PORT}`);
  console.log(`API proxy: http://localhost:${PORT}/api -> http://localhost:5000/api`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
