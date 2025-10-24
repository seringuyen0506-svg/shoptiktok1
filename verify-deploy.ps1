#!/usr/bin/env pwsh
# ============================================
# PRE-DEPLOYMENT VERIFICATION SCRIPT
# Checks everything before running deploy.ps1
# ============================================

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   🔍 PRE-DEPLOYMENT VERIFICATION 🔍       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$errors = @()
$warnings = @()

# ============================================
# 1. Check Git Status
# ============================================
Write-Host "📋 [1/8] Checking Git status..." -ForegroundColor Yellow

$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "   ✅ Changes detected - will be committed" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  No changes to deploy" -ForegroundColor Yellow
    $warnings += "No git changes"
}

# Check current branch
$branch = git branch --show-current
if ($branch -ne "wip/proxy-debug-2025-10-22") {
    Write-Host "   ⚠️  Current branch: $branch (expected: wip/proxy-debug-2025-10-22)" -ForegroundColor Yellow
    $warnings += "Wrong branch"
} else {
    Write-Host "   ✅ On correct branch: $branch" -ForegroundColor Green
}

# ============================================
# 2. Check Backend Files
# ============================================
Write-Host ""
Write-Host "📋 [2/8] Checking backend files..." -ForegroundColor Yellow

if (Test-Path "backend/index.js") {
    Write-Host "   ✅ backend/index.js exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ backend/index.js missing!" -ForegroundColor Red
    $errors += "Missing backend/index.js"
}

if (Test-Path "backend/package.json") {
    Write-Host "   ✅ backend/package.json exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ backend/package.json missing!" -ForegroundColor Red
    $errors += "Missing backend/package.json"
}

# Check for PORT consistency
$backendCode = Get-Content "backend/index.js" -Raw
if ($backendCode -match "process\.env\.PORT \|\| 8080") {
    Write-Host "   ✅ Backend uses PORT 8080" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Backend PORT might be inconsistent" -ForegroundColor Yellow
    $warnings += "Backend PORT unclear"
}

# ============================================
# 3. Check Frontend Files
# ============================================
Write-Host ""
Write-Host "📋 [3/8] Checking frontend files..." -ForegroundColor Yellow

if (Test-Path "frontend/index.html") {
    Write-Host "   ✅ frontend/index.html exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ frontend/index.html missing!" -ForegroundColor Red
    $errors += "Missing frontend/index.html"
}

if (Test-Path "frontend/app.js") {
    Write-Host "   ✅ frontend/app.js exists" -ForegroundColor Green
    $appSize = (Get-Item "frontend/app.js").Length / 1KB
    Write-Host "      Size: $([math]::Round($appSize, 2)) KB" -ForegroundColor Gray
} else {
    Write-Host "   ❌ frontend/app.js missing!" -ForegroundColor Red
    $errors += "Missing frontend/app.js"
}

if (Test-Path "frontend/unified-server.js") {
    Write-Host "   ✅ frontend/unified-server.js exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ frontend/unified-server.js missing!" -ForegroundColor Red
    $errors += "Missing frontend/unified-server.js"
}

# Check unified-server proxy target
$unifiedServer = Get-Content "frontend/unified-server.js" -Raw
if ($unifiedServer -match "localhost:8080") {
    Write-Host "   ✅ unified-server proxies to port 8080" -ForegroundColor Green
} else {
    Write-Host "   ❌ unified-server proxy target wrong!" -ForegroundColor Red
    $errors += "unified-server proxy misconfigured"
}

# ============================================
# 4. Check Package Dependencies
# ============================================
Write-Host ""
Write-Host "📋 [4/8] Checking package.json files..." -ForegroundColor Yellow

$backendPkg = Get-Content "backend/package.json" | ConvertFrom-Json
if ($backendPkg.dependencies.puppeteer) {
    Write-Host "   ✅ Puppeteer listed in backend dependencies" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Puppeteer not in dependencies" -ForegroundColor Yellow
    $warnings += "Puppeteer missing"
}

$frontendPkg = Get-Content "frontend/package.json" | ConvertFrom-Json
if ($frontendPkg.dependencies.express) {
    Write-Host "   ✅ Express listed in frontend dependencies" -ForegroundColor Green
} else {
    Write-Host "   ❌ Express missing from frontend!" -ForegroundColor Red
    $errors += "Frontend missing express"
}

# ============================================
# 5. Check Environment Config
# ============================================
Write-Host ""
Write-Host "📋 [5/8] Checking environment config..." -ForegroundColor Yellow

if (Test-Path ".env.example") {
    Write-Host "   ✅ .env.example exists" -ForegroundColor Green
    
    $envExample = Get-Content ".env.example" -Raw
    if ($envExample -match "PORT=8080") {
        Write-Host "   ✅ .env.example has PORT=8080" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  .env.example PORT might be wrong" -ForegroundColor Yellow
        $warnings += ".env.example PORT unclear"
    }
} else {
    Write-Host "   ⚠️  .env.example missing" -ForegroundColor Yellow
    $warnings += "No .env.example"
}

# ============================================
# 6. Check SSH Connection
# ============================================
Write-Host ""
Write-Host "📋 [6/8] Testing SSH connection..." -ForegroundColor Yellow

$sshTest = ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@148.230.100.21 "echo OK" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ SSH connection successful" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  SSH connection requires password" -ForegroundColor Yellow
    Write-Host "      (This is normal - you'll enter password during deploy)" -ForegroundColor Gray
}

# ============================================
# 7. Check Documentation
# ============================================
Write-Host ""
Write-Host "📋 [7/8] Checking documentation..." -ForegroundColor Yellow

$docs = @("README.md", "DEPLOYMENT_CHECKLIST_FINAL.md", "PRE_DEPLOYMENT_SUMMARY.md")
foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Write-Host "   ✅ $doc exists" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $doc missing" -ForegroundColor Yellow
    }
}

# ============================================
# 8. Check Deploy Script
# ============================================
Write-Host ""
Write-Host "📋 [8/8] Checking deploy.ps1..." -ForegroundColor Yellow

if (Test-Path "deploy.ps1") {
    Write-Host "   ✅ deploy.ps1 exists" -ForegroundColor Green
    
    $deployScript = Get-Content "deploy.ps1" -Raw
    if ($deployScript -match "PORT=8080") {
        Write-Host "   ✅ deploy.ps1 uses PORT=8080" -ForegroundColor Green
    } else {
        Write-Host "   ❌ deploy.ps1 PORT misconfigured!" -ForegroundColor Red
        $errors += "deploy.ps1 PORT wrong"
    }
} else {
    Write-Host "   ❌ deploy.ps1 missing!" -ForegroundColor Red
    $errors += "No deploy.ps1"
}

# ============================================
# SUMMARY
# ============================================
Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           VERIFICATION SUMMARY             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "✅ ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Ready to deploy! Run:" -ForegroundColor Cyan
    Write-Host "   .\deploy.ps1" -ForegroundColor White
} elseif ($errors.Count -eq 0) {
    Write-Host "✅ No critical errors" -ForegroundColor Green
    Write-Host "⚠️  $($warnings.Count) warning(s):" -ForegroundColor Yellow
    foreach ($w in $warnings) {
        Write-Host "   • $w" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "🚀 Safe to deploy! Run:" -ForegroundColor Cyan
    Write-Host "   .\deploy.ps1" -ForegroundColor White
} else {
    Write-Host "❌ $($errors.Count) CRITICAL ERROR(S):" -ForegroundColor Red
    foreach ($e in $errors) {
        Write-Host "   • $e" -ForegroundColor Red
    }
    Write-Host ""
    if ($warnings.Count -gt 0) {
        Write-Host "⚠️  $($warnings.Count) warning(s):" -ForegroundColor Yellow
        foreach ($w in $warnings) {
            Write-Host "   • $w" -ForegroundColor Yellow
        }
    }
    Write-Host ""
    Write-Host "🛑 FIX ERRORS BEFORE DEPLOYING!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
