# ============================================
# PUSH CODE LÊN GITHUB - PowerShell Commands
# ============================================

# 1. Kiểm tra git status
git status

# 2. Add tất cả files
git add .

# 3. Commit với message
git commit -m "Production ready v1.0.0 - Complete TikTok Shop Crawler with AI analysis"

# 4. Push lên GitHub
git push origin wip/proxy-debug-2025-10-22

# Hoặc nếu muốn push lên main branch:
# git push origin main

# ============================================
# NẾU GẶP LỖI AUTHENTICATION
# ============================================

# Option 1: Dùng GitHub CLI (khuyên dùng)
gh auth login
# Sau đó push lại:
git push origin wip/proxy-debug-2025-10-22

# Option 2: Dùng Personal Access Token
# 1. Tạo token tại: https://github.com/settings/tokens
# 2. Copy token
# 3. Push với token:
git push https://YOUR_TOKEN@github.com/seringuyen0506-svg/shoptiktok1.git wip/proxy-debug-2025-10-22

# ============================================
# MERGE VÀO MAIN (SAU KHI PUSH)
# ============================================

# Nếu muốn merge branch hiện tại vào main:
git checkout main
git pull origin main
git merge wip/proxy-debug-2025-10-22
git push origin main

# ============================================
# KIỂM TRA SAU KHI PUSH
# ============================================

# Check remote repo
git remote -v

# Check branch hiện tại
git branch

# Check commit history
git log --oneline -5
