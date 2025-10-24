# 🚀 DEPLOYMENT CHECKLIST - TikTok Shop Crawler

## ✅ Pre-Deployment Checks

### 1. Configuration Files
- [x] `.env` file exists (copy from `.env.example`)
- [x] `PORT=8080` set correctly in `.env`
- [x] `ALLOW_ORIGINS` includes production domain
- [x] `NODE_ENV=production` set

### 2. Code Quality
- [x] No syntax errors in backend/frontend
- [x] Port consistency (8080 everywhere)
- [x] Console.logs appropriate (debug only)
- [x] Error handling implemented

### 3. Security
- [x] CORS properly configured
- [x] Environment variables not hardcoded
- [x] API keys stored in `.env` only
- [x] `.gitignore` includes `.env`, `node_modules/`, `data/`

### 4. Docker Configuration
- [x] `docker-compose.yml` correct
- [x] `docker-compose.prod.yml` for HTTPS
- [x] Nginx config points to port 8080
- [x] Volume mounts correct (`backend-data`)

### 5. Frontend
- [x] `unified-server.js` proxies to port 8080
- [x] Static files in correct location
- [x] `index.html` loads `app.js` with version param
- [x] UI features complete (checkboxes, notes, growth %)

### 6. Backend
- [x] All endpoints working (`/api/crawl`, `/api/crawl-shop-only`, `/api/history`)
- [x] Sequential crawl logic correct
- [x] Browser management (session, tab close)
- [x] History persistence (JSON file)

---

## 🔧 Issues Fixed

### Port Consistency ✅
**Problem**: Mixed ports (5000 vs 8080) across files
**Solution**: 
- Backend: `PORT=8080` everywhere
- `unified-server.js`: Proxy to `http://localhost:8080`
- `.env.example`: Default `PORT=8080`
- README: Updated manual setup instructions

### Frontend Features ✅
- Added **checkbox column** for bulk selection
- Added **note column** after Store Name with edit/save
- Added **bulk actions bar** (Crawl lại, Xóa)
- Added **growth % calculation** per day
- Removed unnecessary "Crawl Shop Products" section

### Shop Link Support ✅
- Auto-detect shop links (`/shop/store/...`)
- Use `/api/crawl-shop-only` endpoint
- Mixed links handled separately

### Data Persistence ✅
- Notes saved to `localStorage.shopNotes`
- Auto-load notes on page refresh
- Growth calculated from historical data

---

## 🚀 Deployment Commands

### Local Testing
```bash
# Start backend
cd backend
PORT=8080 node index.js

# Start frontend (new terminal)
cd frontend
PORT=3000 node unified-server.js

# Test
curl http://localhost:3000/health
```

### Docker Deployment (Production)
```bash
# Build and start
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Check logs
docker compose logs -f backend
docker compose logs -f frontend

# Check health
curl http://localhost/health
curl http://localhost/api/health
```

### Cloudflare Tunnel (Alternative)
```bash
# Start backend
cd backend && PORT=8080 node index.js &

# Start unified server
cd frontend && PORT=3000 node unified-server.js &

# Start tunnel
cloudflared tunnel --url http://localhost:3000
```

---

## 📊 Post-Deployment Verification

### Health Checks
- [ ] `GET /health` returns 200
- [ ] `GET /api/health` returns 200
- [ ] Frontend loads without errors

### Functionality Tests
- [ ] Crawl single product link works
- [ ] Crawl shop link works
- [ ] Bulk crawl multiple links works
- [ ] History displays correctly
- [ ] Growth % calculates correctly
- [ ] Notes save and persist
- [ ] Checkbox selection works
- [ ] Bulk actions (Crawl lại, Xóa) work

### Performance Tests
- [ ] Sequential crawl completes (1 link at a time)
- [ ] Browser stays open during crawl
- [ ] Tabs close after each link
- [ ] Memory usage acceptable

### UI/UX Tests
- [ ] No console errors
- [ ] Responsive design works
- [ ] Progress bar displays correctly
- [ ] Error messages user-friendly

---

## 🐛 Known Issues & Workarounds

### Issue: Browser Detection
**Symptom**: TikTok blocks crawler  
**Workaround**: Use US residential proxy with valid credentials

### Issue: CAPTCHA
**Symptom**: CAPTCHA appears during crawl  
**Workaround**: Use hmcaptcha.com API key (set in UI or `.env`)

### Issue: Geo-Restriction (23002102)
**Symptom**: "This content isn't available in your region"  
**Workaround**: MUST use US proxy

### Issue: Rate Limiting
**Symptom**: TikTok blocks after many requests  
**Workaround**: Add delays between crawls, use different proxies

---

## 📝 Environment Variables Reference

```bash
# Backend
PORT=8080                           # Backend server port
NODE_ENV=production                 # Production mode
ALLOW_ORIGINS=https://yourdomain.com  # CORS whitelist

# Optional
DEFAULT_PROXY=ip:port:user:pass     # Default proxy
HMCAPTCHA_API_KEY=your_key          # CAPTCHA solver
```

---

## 🎯 Success Criteria

- ✅ All health checks pass
- ✅ Crawl product link returns data
- ✅ Crawl shop link returns data
- ✅ History persists across restarts
- ✅ UI responsive and error-free
- ✅ Growth % displays correctly
- ✅ Notes save and load correctly
- ✅ Sequential crawl works (no parallel)
- ✅ Browser management correct (stays open, tabs close)

---

## 📞 Support

For issues or questions:
- Check logs: `docker compose logs -f backend`
- Review: `PRODUCTION_READINESS.md`
- GitHub Issues: [seringuyen0506-svg/shoptiktok1](https://github.com/seringuyen0506-svg/shoptiktok1)

---

**Last Updated**: 2025-10-24  
**Status**: ✅ READY FOR PRODUCTION
