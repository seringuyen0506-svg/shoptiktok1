# Test TikTok Crawler

Write-Host "🧪 Testing TikTok crawler..." -ForegroundColor Cyan
Write-Host ""

$body = @{
    links = @("https://vt.tiktok.com/ZSjq4LWQG/")
    proxy = "43.159.20.117:12233:user-ZP85NKvw-region-us-sessid-UUo9s9kd-sesstime-1:SgcjjxXh"
    apiKey = ""
} | ConvertTo-Json

Write-Host "📡 Sending request to backend..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/crawl" -Method Post -Body $body -ContentType "application/json"
    
    Write-Host ""
    Write-Host "✅ Response received:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5
    
    $result = $response.results[0]
    
    if ($result.status -eq "success") {
        Write-Host ""
        Write-Host "🎉 SUCCESS! Data extracted:" -ForegroundColor Green
        Write-Host "  - Shop Name: $($result.shopName)" -ForegroundColor White
        Write-Host "  - Shop Sold: $($result.shopSold)" -ForegroundColor White
        Write-Host "  - Product Name: $($result.productName)" -ForegroundColor White
        Write-Host "  - Product Sold: $($result.productSold)" -ForegroundColor White
    }
    elseif ($result.status -eq "captcha_detected") {
        Write-Host ""
        Write-Host "⚠️  Captcha detected - need API key to solve" -ForegroundColor Yellow
    }
    else {
        Write-Host ""
        Write-Host "❌ Failed: $($result.status)" -ForegroundColor Red
        Write-Host "  Error: $($result.error ?? $result.message)" -ForegroundColor Red
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ Test failed: $_" -ForegroundColor Red
}
