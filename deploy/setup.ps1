# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Proteus OS One-Click Deploy Script (Windows)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Bắt đầu cài đặt Proteus OS..." -ForegroundColor Cyan

# 1. Check prerequisites
$requiredCommands = @("docker")
foreach ($cmd in $requiredCommands) {
    if (!(Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Lỗi: Yêu cầu cài đặt '$cmd' để chạy script này." -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Prerequisites OK." -ForegroundColor Green

# Set working directory to the script's directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -Path $scriptDir

# 2. Xử lý file .env
$envFile = ".env"
$envExampleFile = ".env.example"

if (-Not (Test-Path $envFile)) {
    if (Test-Path $envExampleFile) {
        Write-Host "📄 Khởi tạo file .env từ .env.example..." -ForegroundColor Yellow
        Copy-Item -Path $envExampleFile -Destination $envFile
        
        # 3. Auto-generate NEXTAUTH_SECRET and N8N_ENCRYPTION_KEY
        $nextAuthSecretBytes = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($nextAuthSecretBytes)
        $nextAuthSecret = [Convert]::ToBase64String($nextAuthSecretBytes)
        
        $n8nEncryptionKeyBytes = New-Object byte[] 32
        $rng.GetBytes($n8nEncryptionKeyBytes)
        $n8nEncryptionKey = [BitConverter]::ToString($n8nEncryptionKeyBytes).Replace("-", "").ToLower()
        
        $envContent = Get-Content -Path $envFile -Raw
        $envContent = $envContent -replace "NEXTAUTH_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL", "NEXTAUTH_SECRET=$nextAuthSecret"
        $envContent = $envContent -replace "N8N_ENCRYPTION_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL", "N8N_ENCRYPTION_KEY=$n8nEncryptionKey"
        
        Set-Content -Path $envFile -Value $envContent -Encoding UTF8
        
        Write-Host "✅ Đã tạo .env và generate secret keys." -ForegroundColor Green
    } else {
        Write-Host "❌ Lỗi: Không tìm thấy file .env.example" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "ℹ️  File .env đã tồn tại, bỏ qua bước khởi tạo." -ForegroundColor Cyan
}

# Đọc DOMAIN từ .env
$domain = "proteus.local"
if (Test-Path $envFile) {
    $domainLine = Get-Content -Path $envFile | Where-Object { $_ -match "^DOMAIN=" }
    if ($domainLine) {
        $domain = $domainLine.Split('=')[1].Trim('"', "'")
    }
}

# 4. Hướng dẫn sửa hosts file
if ($domain -eq "proteus.local") {
    Write-Host ""
    Write-Host "⚠️  LƯU Ý: Bạn đang dùng domain local ($domain)." -ForegroundColor Yellow
    Write-Host "Hãy đảm bảo file hosts (C:\Windows\System32\drivers\etc\hosts) có dòng sau:"
    Write-Host "127.0.0.1 proteus.local auth.proteus.local wiki.proteus.local analytics.proteus.local apps.proteus.local workflow.proteus.local chat.proteus.local"
    Write-Host ""
}

# 5. Khởi động Docker Compose
Write-Host "🐳 Khởi động các dịch vụ qua Docker Compose..." -ForegroundColor Cyan
docker compose up -d

# 6. Wait healthchecks
Write-Host "⏳ Đang chờ các dịch vụ khởi động (có thể mất 1-2 phút)..." -ForegroundColor Yellow
$timeout = 120
$elapsed = 0

while ($elapsed -lt $timeout) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/health" -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.Content -match "status") {
            Write-Host "✅ Backend đã sẵn sàng!" -ForegroundColor Green
            break
        }
    } catch {
        # ignore exception
    }
    
    Start-Sleep -Seconds 5
    $elapsed += 5
}

if ($elapsed -ge $timeout) {
    Write-Host "⚠️  Cảnh báo: Hết thời gian chờ backend khởi động (120s)." -ForegroundColor Yellow
    Write-Host "Vui lòng kiểm tra log: docker compose logs backend" -ForegroundColor Yellow
}

# 7. Print URLs
Write-Host ""
Write-Host "🎉 Proteus OS triển khai hoàn tất!" -ForegroundColor Green
Write-Host "Truy cập các dịch vụ tại:"
Write-Host "------------------------------------------------------"
Write-Host "👉 Launchpad (Frontend): http://$domain"
Write-Host "👉 Backend API Docs    : http://$domain/api/docs"
Write-Host "👉 SSO (Keycloak)      : http://auth.$domain"
Write-Host "👉 Workflow (n8n)      : http://workflow.$domain"
Write-Host "👉 BI & Dashboard      : http://analytics.$domain"
Write-Host "👉 Low-code UI Apps    : http://apps.$domain"
Write-Host "👉 Knowledge Base      : http://wiki.$domain"
Write-Host "👉 ChatOps (Mattermost): http://$domain/chat/"
Write-Host "👉 Observability (Grafana): http://grafana.$domain"
Write-Host "👉 Traefik Dashboard   : http://traefik.$domain"
Write-Host "------------------------------------------------------"
Write-Host "Tài khoản mặc định: admin / admin (Keycloak)"
Write-Host "Chúc bạn sử dụng Proteus OS hiệu quả!" -ForegroundColor Cyan
