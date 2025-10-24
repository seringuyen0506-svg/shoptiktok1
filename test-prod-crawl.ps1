# Test production crawl
Write-Host "Testing production crawl..." -ForegroundColor Cyan

$body = @{
    links = @("https://www.tiktok.com/@blushheartusstore/video/7437226473903287595")
    proxy = ""
    apiKey = ""
} | ConvertTo-Json

Write-Host "Sending request..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "https://ttshoptool.fun/api/crawl" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -UseBasicParsing `
        -TimeoutSec 180
    
    $result = $response.Content | ConvertFrom-Json
    
    Write-Host "`n✅ Success!" -ForegroundColor Green
    Write-Host "Message: $($result.message)" -ForegroundColor Yellow
    Write-Host "Results:" -ForegroundColor Cyan
    $result.results | ForEach-Object {
        Write-Host "  Shop: $($_.shopName)" -ForegroundColor White
        Write-Host "  Shop Sold: $($_.shopSold)" -ForegroundColor White
        Write-Host "  Product: $($_.productName)" -ForegroundColor White
        Write-Host "  Product Sold: $($_.productSold)" -ForegroundColor White
        Write-Host ""
    }
} catch {
    Write-Host "`n❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
}
