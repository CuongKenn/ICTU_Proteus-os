# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Proteus OS One-Click Deploy Script (Windows PowerShell)

$ErrorActionPreference = "Continue"

Write-Host "==> Starting Proteus OS setup..." -ForegroundColor Cyan

# 1. Check prerequisites
$requiredCommands = @("docker")
foreach ($cmd in $requiredCommands) {
    if (!(Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] Required command '$cmd' not found. Please install it first." -ForegroundColor Red
        exit 1
    }
}
Write-Host "[OK] Prerequisites check passed." -ForegroundColor Green

# Set working directory to script's directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -Path $scriptDir

$envFile = ".env"
$envExampleFile = ".env.example"

# Helper: set/add KEY=VALUE in .env
function Set-EnvValue([string]$Key, [string]$Value) {
    $c = if (Test-Path $envFile) { Get-Content -Path $envFile -Raw -Encoding UTF8 } else { "" }
    if ($c -match "(?m)^$Key=.*$") { $c = $c -replace "(?m)^$Key=.*$", "$Key=$Value" }
    else {
        if ($c -and -not $c.EndsWith("`n")) { $c += "`r`n" }
        $c += "$Key=$Value`r`n"
    }
    Set-Content -Path $envFile -Value $c -Encoding UTF8 -NoNewline
}

function Set-PublicUrls([string]$Scheme, [string]$Domain, [string]$Suffix) {
    Set-EnvValue "NEXT_PUBLIC_MATTERMOST_URL" "$Scheme`://chat.$Domain$Suffix"
    Set-EnvValue "NEXT_PUBLIC_OUTLINE_URL"    "$Scheme`://wiki.$Domain$Suffix"
    Set-EnvValue "NEXT_PUBLIC_N8N_URL"        "$Scheme`://workflow.$Domain$Suffix"
    Set-EnvValue "NEXT_PUBLIC_METABASE_URL"   "$Scheme`://analytics.$Domain$Suffix"
    Set-EnvValue "NEXT_PUBLIC_APPSMITH_URL"   "$Scheme`://apps.$Domain$Suffix"
}

# 0. Chon che do trien khai: local dev hay production VPS
Write-Host ""
Write-Host "Chon che do trien khai:" -ForegroundColor Cyan
Write-Host "  1) Local dev   - proteus.local, HTTP (may dev/laptop)"
Write-Host "  2) Production  - domain that, HTTPS + Let's Encrypt (VPS)"
$existingMode = $null
if (Test-Path $envFile) {
    $m = Get-Content -Path $envFile -Encoding UTF8 | Where-Object { $_ -match "^APP_MODE=" }
    if ($m) { $existingMode = ($m[0] -split '=', 2)[1].Trim('"', "'", " ") }
}
$defaultChoice = if ($existingMode -eq "production") { "2" } else { "1" }
$modeChoice = Read-Host "Lua chon [1/2, mac dinh: $defaultChoice]"
if (-not $modeChoice) { $modeChoice = $defaultChoice }
$appMode = if ($modeChoice -eq "2") { "production" } else { "local" }

if ($appMode -eq "production") {
    $publicScheme = "https"; $scheme = "https"
    $composeFiles = "docker-compose.yml:docker-compose.prod.yml"
    $outlineForceHttps = "true"; $n8nProtocol = "https"; $n8nSecureCookie = "true"
    $kcStartMode = "start --optimized"
} else {
    $publicScheme = "http"; $scheme = "http"
    $composeFiles = "docker-compose.yml"
    $outlineForceHttps = "false"; $n8nProtocol = "http"; $n8nSecureCookie = "false"
    $kcStartMode = "start-dev"
}
Write-Host "-> Che do: $appMode (scheme: $publicScheme)" -ForegroundColor Green

# DOMAIN: hoi moi lan chay de ho tro doi mode / doi domain
$currentDomain = $null
if (Test-Path $envFile) {
    $d = Get-Content -Path $envFile -Encoding UTF8 | Where-Object { $_ -match "^DOMAIN=" }
    if ($d) { $currentDomain = ($d[0] -split '=', 2)[1].Trim('"', "'", " ") }
}
if ($appMode -eq "production") {
    $domainDefault = $currentDomain
    if (-not $domainDefault -or $domainDefault -like "*.local") { $domainDefault = "" }
    while ($true) {
        if ($domainDefault) { $domainInput = Read-Host "Domain production (VD: proteus.example.com) [$domainDefault]"; if (-not $domainInput) { $domainInput = $domainDefault } }
        else { $domainInput = Read-Host "Domain production (VD: proteus.example.com)" }
        $domainInput = ($domainInput -replace '^https?://', '') -replace '/$', ''
        if (-not $domainInput) { Write-Host "[ERROR] Domain khong duoc de trong." -ForegroundColor Red; continue }
        if ($domainInput -like "*.local") { Write-Host "[ERROR] Production khong dung *.local. Nhap domain that." -ForegroundColor Red; continue }
        $domain = $domainInput; break
    }
    $currentLE = $null
    if (Test-Path $envFile) {
        $l = Get-Content -Path $envFile -Encoding UTF8 | Where-Object { $_ -match "^LETSENCRYPT_EMAIL=" }
        if ($l) { $currentLE = ($l[0] -split '=', 2)[1].Trim('"', "'", " ") }
    }
    if (-not $currentLE -or $currentLE -like "*@example.com") { $currentLE = "admin@$domain" }
    $leInput = Read-Host "Email Let's Encrypt [$currentLE]"
    $letsEncryptEmail = if ($leInput) { $leInput } else { $currentLE }
    # Host port cho Traefik (doi khi trung app khac tren VPS)
    $curHttp = $null; $curHttps = $null
    if (Test-Path $envFile) {
        $h = Get-Content -Path $envFile -Encoding UTF8 | Where-Object { $_ -match "^TRAEFIK_HTTP_PORT=" }
        if ($h) { $curHttp = ($h[0] -split '=', 2)[1].Trim() }
        $s = Get-Content -Path $envFile -Encoding UTF8 | Where-Object { $_ -match "^TRAEFIK_HTTPS_PORT=" }
        if ($s) { $curHttps = ($s[0] -split '=', 2)[1].Trim() }
    }
    $httpPortInput = Read-Host "Host port HTTP (Traefik, Let's Encrypt can 80) [$(if ($curHttp) { $curHttp } else { '80' })]"
    $httpsPortInput = Read-Host "Host port HTTPS (Traefik) [$(if ($curHttps) { $curHttps } else { '443' })]"
    $httpPort = if ($httpPortInput) { $httpPortInput } elseif ($curHttp) { $curHttp } else { "80" }
    $httpsPort = if ($httpsPortInput) { $httpsPortInput } elseif ($curHttps) { $curHttps } else { "443" }
    $urlSuffix = if ($httpsPort -ne "443") { ":$httpsPort" } else { "" }
} else {
    $domainSuggest = if ($currentDomain) { $currentDomain } else { "proteus.local" }
    $domainInput = Read-Host "DOMAIN [$domainSuggest]"
    $domain = if ($domainInput) { $domainInput } else { $domainSuggest }
    $letsEncryptEmail = "admin@example.com"
    $httpPort = "80"; $httpsPort = "443"; $urlSuffix = ""
}
Write-Host "-> Domain: $domain (HTTP :$httpPort, HTTPS :$httpsPort)" -ForegroundColor Green

# 2. Initialize .env

if (-Not (Test-Path $envFile)) {
    if (Test-Path $envExampleFile) {
        Write-Host "[INFO] Initializing .env from .env.example..." -ForegroundColor Yellow
        Copy-Item -Path $envExampleFile -Destination $envFile

        # Ap che do vua chon vao .env moi
        Set-EnvValue "APP_MODE" $appMode
        Set-EnvValue "DOMAIN" $domain
        Set-EnvValue "PUBLIC_SCHEME" $publicScheme
        Set-EnvValue "COMPOSE_FILE" $composeFiles
        Set-EnvValue "LETSENCRYPT_EMAIL" $letsEncryptEmail
        Set-EnvValue "OUTLINE_FORCE_HTTPS" $outlineForceHttps
        Set-EnvValue "N8N_PROTOCOL" $n8nProtocol
        Set-EnvValue "N8N_SECURE_COOKIE" $n8nSecureCookie
        Set-EnvValue "KEYCLOAK_START_MODE" $kcStartMode
        Set-EnvValue "TRAEFIK_HTTP_PORT" $httpPort
        Set-EnvValue "TRAEFIK_HTTPS_PORT" $httpsPort
        Set-EnvValue "PUBLIC_URL_SUFFIX" $urlSuffix
        Set-PublicUrls $publicScheme $domain $urlSuffix

        # 3. Auto-generate Secrets
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

        function Get-RandomHex([int]$length) {
            $bytes = New-Object byte[] $length
            $rng.GetBytes($bytes)
            return [BitConverter]::ToString($bytes).Replace("-", "").ToLower()
        }

        function Get-RandomBase64([int]$length) {
            $bytes = New-Object byte[] $length
            $rng.GetBytes($bytes)
            return [Convert]::ToBase64String($bytes)
        }

        $nextAuthSecret    = Get-RandomBase64(32)
        $n8nEncryptionKey  = Get-RandomHex(32)
        $outlineSecretKey  = Get-RandomHex(32)
        $outlineUtilsSecret = Get-RandomHex(32)
        $metabaseSecretKey = Get-RandomHex(32)

        $envContent = Get-Content -Path $envFile -Raw -Encoding UTF8
        $envContent = $envContent -replace "NEXTAUTH_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL",    "NEXTAUTH_SECRET=$nextAuthSecret"
        $envContent = $envContent -replace "N8N_ENCRYPTION_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL", "N8N_ENCRYPTION_KEY=$n8nEncryptionKey"
        $envContent = $envContent -replace "OUTLINE_SECRET_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL.*",   "OUTLINE_SECRET_KEY=$outlineSecretKey"
        $envContent = $envContent -replace "OUTLINE_UTILS_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL.*", "OUTLINE_UTILS_SECRET=$outlineUtilsSecret"
        $envContent = $envContent -replace "METABASE_SECRET_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL",    "METABASE_SECRET_KEY=$metabaseSecretKey"

        Write-Host "Thiết lập các thông tin tài khoản (Nhấn Enter để dùng giá trị mặc định/ngẫu nhiên):" -ForegroundColor Cyan
        
        $pgUser = Read-Host "POSTGRES_USER [proteus]"
        if (-not $pgUser) { $pgUser = "proteus" }
        
        $pgPass = Read-Host "POSTGRES_PASSWORD [random]"
        if (-not $pgPass) { $pgPass = Get-RandomHex 12 }
        
        $redisPass = Read-Host "REDIS_PASSWORD [random]"
        if (-not $redisPass) { $redisPass = Get-RandomHex 12 }
        
        $kcUser = Read-Host "KEYCLOAK_ADMIN_USER [admin]"
        if (-not $kcUser) { $kcUser = "admin" }
        
        $kcPass = Read-Host "KEYCLOAK_ADMIN_PASSWORD [random]"
        if (-not $kcPass) { $kcPass = Get-RandomHex 12 }
        
        $mmPass = Read-Host "MATTERMOST_ADMIN_PASSWORD [random]"
        if (-not $mmPass) { $mmPass = Get-RandomHex 12 }
        
        $appsmithPass = Read-Host "APPSMITH_ADMIN_PASSWORD [random]"
        if (-not $appsmithPass) { $appsmithPass = Get-RandomHex 12 }

        $envContent = $envContent -replace "POSTGRES_USER=proteus", "POSTGRES_USER=$pgUser"
        $envContent = $envContent -replace "POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD_HERE", "POSTGRES_PASSWORD=$pgPass"
        $envContent = $envContent -replace "REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD_HERE", "REDIS_PASSWORD=$redisPass"
        $envContent = $envContent -replace "KEYCLOAK_ADMIN_USER=admin", "KEYCLOAK_ADMIN_USER=$kcUser"
        $envContent = $envContent -replace "KEYCLOAK_ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASSWORD_HERE", "KEYCLOAK_ADMIN_PASSWORD=$kcPass"
        $envContent = $envContent -replace "MATTERMOST_ADMIN_PASSWORD=CHANGE_ME_STRONG_PASSWORD_HERE_123", "MATTERMOST_ADMIN_PASSWORD=$mmPass"
        $envContent = $envContent -replace "APPSMITH_ADMIN_PASSWORD=CHANGE_ME_STRONG_PASSWORD_HERE", "APPSMITH_ADMIN_PASSWORD=$appsmithPass"

        Set-Content -Path $envFile -Value $envContent -Encoding UTF8

        Write-Host "[OK] .env created and secret keys generated." -ForegroundColor Green
    } else {
        Write-Host "[ERROR] .env.example not found." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[INFO] .env already exists, applying mode '$appMode' to current config." -ForegroundColor Cyan
    Set-EnvValue "APP_MODE" $appMode
    Set-EnvValue "DOMAIN" $domain
    Set-EnvValue "PUBLIC_SCHEME" $publicScheme
    Set-EnvValue "COMPOSE_FILE" $composeFiles
    Set-EnvValue "LETSENCRYPT_EMAIL" $letsEncryptEmail
    Set-EnvValue "OUTLINE_FORCE_HTTPS" $outlineForceHttps
    Set-EnvValue "N8N_PROTOCOL" $n8nProtocol
    Set-EnvValue "N8N_SECURE_COOKIE" $n8nSecureCookie
    Set-EnvValue "KEYCLOAK_START_MODE" $kcStartMode
    Set-EnvValue "TRAEFIK_HTTP_PORT" $httpPort
    Set-EnvValue "TRAEFIK_HTTPS_PORT" $httpsPort
    Set-EnvValue "PUBLIC_URL_SUFFIX" $urlSuffix
    Set-PublicUrls $publicScheme $domain $urlSuffix
    # Bu secret cho .env cu tu phien ban truoc (khong dung gia tri that)
    $envCheck = Get-Content $envFile -Raw -Encoding UTF8
    if ($envCheck -match "METABASE_SECRET_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL") {
        $rng2 = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $b2 = New-Object byte[] 32; $rng2.GetBytes($b2)
        Set-EnvValue "METABASE_SECRET_KEY" ([BitConverter]::ToString($b2).Replace("-", "").ToLower())
        Write-Host "[OK] Generated missing METABASE_SECRET_KEY." -ForegroundColor Green
    }
}

# Refresh DOMAIN (mode co the vua doi domain)
$domainLine = Get-Content -Path $envFile -Encoding UTF8 | Where-Object { $_ -match "^DOMAIN=" }
if ($domainLine) { $domain = ($domainLine[0] -split '=', 2)[1].Trim('"', "'", " ") }

# Render traefik static config theo mode (static config khong doc env).
if ($appMode -eq "production") {
    $prodTpl = Get-Content -Path "traefik/traefik.prod.yml" -Raw -Encoding UTF8
    $prodTpl = $prodTpl -replace "__LETSENCRYPT_EMAIL__", $letsEncryptEmail
    Set-Content -Path "traefik/traefik.yml" -Value $prodTpl -Encoding UTF8 -NoNewline
    Write-Host "[OK] Rendered traefik.yml (production, Let's Encrypt: $letsEncryptEmail)." -ForegroundColor Green
} else {
    Copy-Item -Path "traefik/traefik.dev.yml" -Destination "traefik/traefik.yml" -Force
}

# 4. Configure hosts file (local) hoac nhac DNS (production)
if ($domain -like "*.local") {
    $hostsPath = "$env:windir\System32\drivers\etc\hosts"
    $hostsEntry = "127.0.0.1 proteus.local auth.proteus.local wiki.proteus.local analytics.proteus.local apps.proteus.local workflow.proteus.local chat.proteus.local grafana.proteus.local traefik.proteus.local plugins.proteus.local"

    $hostsContent = Get-Content -Path $hostsPath -Raw
    if ($hostsContent -notmatch "proteus\.local") {
        Write-Host "[INFO] Adding entries to hosts file..." -ForegroundColor Yellow
        $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

        if ($isAdmin) {
            Add-Content -Path $hostsPath -Value "`n$hostsEntry"
            Write-Host "[OK] Hosts file updated." -ForegroundColor Green
        } else {
            Write-Host "[WARN] Requesting Administrator privileges to update hosts..." -ForegroundColor Yellow
            $addHostsCommand = "Add-Content -Path '$hostsPath' -Value '`n$hostsEntry'"
            try {
                Start-Process powershell -ArgumentList "-WindowStyle Hidden -Command `"$addHostsCommand`"" -Verb RunAs -Wait
                Write-Host "[OK] Hosts file updated successfully." -ForegroundColor Green
            } catch {
                Write-Host "[ERROR] Failed to update hosts file. Please add manually:" -ForegroundColor Red
                Write-Host $hostsEntry
            }
        }
    } else {
        Write-Host "[INFO] Hosts file already configured for proteus.local." -ForegroundColor Cyan
    }
} else {
    Write-Host "[INFO] Production mode: point DNS (A record) for $domain and subdomains" -ForegroundColor Yellow
    Write-Host "       (auth, wiki, analytics, apps, workflow, chat, plugins, traefik) to this VPS IP," -ForegroundColor Yellow
    Write-Host "       and open firewall ports 80/443. Let's Encrypt needs port 80 reachable." -ForegroundColor Yellow
    Write-Host "[INFO] No subdomain needed for Grafana (served at $domain/monitoring/)." -ForegroundColor Cyan
}

# 5. Start Docker Compose
Write-Host "[INFO] Starting services via Docker Compose..." -ForegroundColor Cyan
docker compose up -d --build
# Static config cua Traefik chi nap luc (re)start - restart de nhan
# traefik.yml vua render (quan trong khi doi mode local <-> production).
docker compose restart traefik

# 6. Wait for backend health
Write-Host "[INFO] Waiting for services to start (may take 1-2 minutes)..." -ForegroundColor Yellow
$timeout = 120
$elapsed = 0

while ($elapsed -lt $timeout) {
    try {
        $response = Invoke-WebRequest -Uri "${scheme}://$domain$urlSuffix/health" -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.Content -match "status") {
            Write-Host "[OK] Backend is ready!" -ForegroundColor Green
            break
        }
    } catch {
        # ignore
    }
    Start-Sleep -Seconds 5
    $elapsed += 5
}

if ($elapsed -ge $timeout) {
    Write-Host "[WARN] Backend startup timed out (120s). Check: docker compose logs backend" -ForegroundColor Yellow
}

# 6.1 Ensure databases exist (Outline, Metabase)
Write-Host "[INFO] Ensuring databases exist (outline, metabase)..." -ForegroundColor Cyan
$sqlCreateDbs = "SELECT 'CREATE DATABASE outline' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'outline')\gexec`nSELECT 'CREATE DATABASE metabase' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'metabase')\gexec"
$tmpCreateSql = Join-Path $env:TEMP "create_dbs.sql"
[System.IO.File]::WriteAllText($tmpCreateSql, $sqlCreateDbs, [System.Text.Encoding]::UTF8)
try {
    Get-Content $tmpCreateSql | docker compose exec -T postgres psql -v ON_ERROR_STOP=0 -U proteus -d postgres 2>$null
    docker compose restart outline metabase
} catch {}
Remove-Item $tmpCreateSql -ErrorAction SilentlyContinue

# 6.5 Helper: REST with retry
function Invoke-RestWithRetry {
    param($Uri, $Method="GET", $Body=$null, $Headers=$null, $ContentType="application/json")
    $retries = 24
    while ($retries -gt 0) {
        try {
            if ($Body) {
                return Invoke-RestMethod -Uri $Uri -Method $Method -Body $Body -Headers $Headers -ContentType $ContentType -UseBasicParsing -ErrorAction Stop
            } else {
                return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers -ContentType $ContentType -UseBasicParsing -ErrorAction Stop
            }
        } catch {
            Start-Sleep -Seconds 5
            $retries--
        }
    }
    return $null
}

# 7. Configure Mattermost (Bot + Webhook Secret)
Write-Host "[INFO] Configuring Mattermost (Bot, Webhook Secret)..." -ForegroundColor Cyan
$envContent = Get-Content .env -Raw -Encoding UTF8
if ($envContent -match "MATTERMOST_WEBHOOK_SECRET=CHANGE_ME") {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 32
    $rng.GetBytes($bytes)
    $mmWebhook = [BitConverter]::ToString($bytes).Replace("-", "").ToLower()
    $envContent = $envContent -replace "MATTERMOST_WEBHOOK_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL", "MATTERMOST_WEBHOOK_SECRET=$mmWebhook"
    Set-Content .env -Value $envContent -Encoding UTF8
}

$mmAdminPass = ($envContent -split "`n" | Where-Object { $_ -match "^MATTERMOST_ADMIN_PASSWORD=" }) -replace "MATTERMOST_ADMIN_PASSWORD=", ""
$mmAdminPass = $mmAdminPass.Trim(" `r")

if ($envContent -match "MATTERMOST_BOT_TOKEN=CHANGE_ME") {
    $mmUrl = "${scheme}://chat.$domain$urlSuffix/api/v4"
    
    # Wait for Mattermost to be ready
    Write-Host "[INFO] Waiting for Mattermost to be ready..." -ForegroundColor Yellow
    $mmTimeout = 120
    $mmElapsed = 0
    while ($mmElapsed -lt $mmTimeout) {
        try {
            $pingRes = Invoke-RestMethod -Uri "$mmUrl/system/ping" -UseBasicParsing -ErrorAction Stop
            if ($pingRes.status -eq "OK") {
                break
            }
        } catch {}
        Start-Sleep -Seconds 5
        $mmElapsed += 5
    }

    if ($mmElapsed -lt $mmTimeout) {
        try {
            Invoke-RestMethod -Uri "$mmUrl/users" -Method Post -Body "{`"email`":`"admin@proteus.local`",`"username`":`"sysadmin`",`"password`":`"$mmAdminPass`",`"allow_marketing`":false}" -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue | Out-Null
        } catch {}

        $loginRes = $null
        try { 
            $loginRes = Invoke-WebRequest -Uri "$mmUrl/users/login" -Method Post -Body "{`"login_id`":`"sysadmin`",`"password`":`"$mmAdminPass`"}" -ContentType "application/json" -UseBasicParsing -ErrorAction Stop 
        } catch {
            Write-Host "[WARN] Mattermost login failed ($($_.Exception.Message)). Did you change the admin password?" -ForegroundColor Yellow
        }
        
        if ($loginRes -and $loginRes.Headers["Token"]) {
            $mmToken = $loginRes.Headers["Token"]
            $authHeaders = @{ "Authorization" = "Bearer $mmToken" }
            try { 
                $mmConfig = Invoke-RestMethod -Uri "$mmUrl/config" -Method Get -Headers $authHeaders -UseBasicParsing -ErrorAction Stop
                $mmConfig.ServiceSettings.EnableBotAccountCreation = $true
                $mmConfig.ServiceSettings.EnableUserAccessTokens = $true
                $mmConfig.GitLabSettings.Enable = $true
                $mmConfig.GitLabSettings.Secret = "mattermost-secret"
                $mmConfig.GitLabSettings.Id = "mattermost"
                $mmConfig.GitLabSettings.AuthEndpoint = "${scheme}://auth.$domain$urlSuffix/realms/proteus/protocol/openid-connect/auth"
                $mmConfig.GitLabSettings.TokenEndpoint = "${scheme}://auth.$domain$urlSuffix/realms/proteus/protocol/openid-connect/token"
                $mmConfig.GitLabSettings.UserAPIEndpoint = "${scheme}://auth.$domain$urlSuffix/realms/proteus/protocol/openid-connect/userinfo"
                Invoke-RestMethod -Uri "$mmUrl/config" -Method Put -Body ($mmConfig | ConvertTo-Json -Depth 10) -Headers $authHeaders -ContentType "application/json" -UseBasicParsing -ErrorAction Stop | Out-Null 
            } catch {
                Write-Host "[WARN] Failed to update Mattermost config: $($_.Exception.Message)" -ForegroundColor Yellow
            }

            try { $botRes = Invoke-RestMethod -Uri "$mmUrl/bots" -Method Post -Body '{"username":"proteus-bot","display_name":"Proteus AI Bot","description":"AI Orchestrator Bot"}' -Headers $authHeaders -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue } catch {}
            $botId = $botRes.user_id
            if (-not $botId) {
                try { $botRes = Invoke-RestMethod -Uri "$mmUrl/users/username/proteus-bot" -Method Get -Headers $authHeaders -UseBasicParsing -ErrorAction SilentlyContinue } catch {}
                $botId = $botRes.id
            }

            if ($botId) {
                try { $tokenRes = Invoke-RestMethod -Uri "$mmUrl/users/$botId/tokens" -Method Post -Body '{"description":"Proteus OS Bot Token"}' -Headers $authHeaders -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue } catch {}
                if ($tokenRes.token) {
                    $envContent = Get-Content .env -Raw -Encoding UTF8
                    $envContent = $envContent -replace "MATTERMOST_BOT_TOKEN=CHANGE_ME_GET_FROM_MATTERMOST", "MATTERMOST_BOT_TOKEN=$($tokenRes.token)"
                    Set-Content .env -Value $envContent -Encoding UTF8
                    Write-Host "[OK] MATTERMOST_BOT_TOKEN generated and saved." -ForegroundColor Green
                    docker compose restart backend
                } else {
                    Write-Host "[WARN] Failed to generate Mattermost Bot Token." -ForegroundColor Yellow
                }
            } else {
                Write-Host "[WARN] Failed to find or create Mattermost Bot user." -ForegroundColor Yellow
            }

            # Tự động điền MATTERMOST_SYSTEM_CHANNEL_ID (Town Square của team đầu tiên)
            $envContent = Get-Content .env -Raw -Encoding UTF8
            if ($envContent -match "MATTERMOST_SYSTEM_CHANNEL_ID=CHANGE_ME_GET_FROM_MATTERMOST") {
                try {
                    $teams = Invoke-RestMethod -Uri "$mmUrl/teams" -Method Get -Headers $authHeaders -UseBasicParsing -ErrorAction Stop
                    $firstTeamId = $teams[0].id
                    if ($firstTeamId) {
                        $town = Invoke-RestMethod -Uri "$mmUrl/teams/$firstTeamId/channels/name/town-square" -Method Get -Headers $authHeaders -UseBasicParsing -ErrorAction Stop
                        if ($town.id) {
                            $envContent = $envContent -replace "MATTERMOST_SYSTEM_CHANNEL_ID=CHANGE_ME_GET_FROM_MATTERMOST", "MATTERMOST_SYSTEM_CHANNEL_ID=$($town.id)"
                            Set-Content .env -Value $envContent -Encoding UTF8
                            Write-Host "[OK] MATTERMOST_SYSTEM_CHANNEL_ID saved." -ForegroundColor Green
                            docker compose restart backend
                        } else {
                            Write-Host "[WARN] Town Square channel not found, keeping placeholder." -ForegroundColor Yellow
                        }
                    } else {
                        Write-Host "[WARN] No Mattermost team yet, keeping placeholder." -ForegroundColor Yellow
                    }
                } catch {
                    Write-Host "[WARN] Failed to resolve system channel: $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
        }
    } else {
        Write-Host "[WARN] Mattermost did not become ready in time." -ForegroundColor Yellow
    }
}

# 8. Configure n8n (Create Owner + inject API Key via DB)
Write-Host "[INFO] Configuring n8n (Owner Account + API Key via DB)..." -ForegroundColor Cyan
$envContent = Get-Content .env -Raw -Encoding UTF8
if ($envContent -match "N8N_API_KEY=CHANGE_ME") {
    $n8nRes = Invoke-RestWithRetry -Uri "${scheme}://workflow.$domain$urlSuffix/rest/owner/setup" -Method Post -Body "{`"email`":`"admin@proteus.local`",`"firstName`":`"Admin`",`"lastName`":`"Proteus`",`"password`":`"$mmAdminPass`"}"
    if ($n8nRes) {
        Write-Host "[OK] n8n Owner account initialized." -ForegroundColor Green
    } else {
        Write-Host "[INFO] n8n Owner account may already exist, proceeding to inject API key..." -ForegroundColor Yellow
    }

    # Generate random API key
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 24
    $rng.GetBytes($bytes)
    $newApiKey = [Convert]::ToBase64String($bytes) -replace "[^a-zA-Z0-9]", ""

    # Inject via DB (PowerShell-native temp file â€” no bash/base64 needed)
    $sql = 'UPDATE n8n."user" SET "apiKey"=''' + $newApiKey + ''' WHERE email=''admin@proteus.local'';'
    $tmpSql = Join-Path $env:TEMP "n8n_key.sql"
    [System.IO.File]::WriteAllText($tmpSql, $sql, [System.Text.Encoding]::UTF8)
    Get-Content $tmpSql | docker compose exec -T postgres psql -U proteus -d proteus | Out-Null
    Remove-Item $tmpSql -ErrorAction SilentlyContinue

    $envContent = Get-Content .env -Raw -Encoding UTF8
    $envContent = $envContent -replace "N8N_API_KEY=CHANGE_ME.*", "N8N_API_KEY=$newApiKey"
    Set-Content .env -Value $envContent -Encoding UTF8
    docker compose restart backend
    Write-Host "[OK] N8N_API_KEY injected via database." -ForegroundColor Green
}


# 8.5 Sync Keycloak OIDC Secrets from DB
Write-Host "[INFO] Syncing Keycloak OIDC Secrets..." -ForegroundColor Cyan
$envContent = Get-Content .env -Raw -Encoding UTF8
if ($envContent -match "CHANGE_ME_GET_FROM_KEYCLOAK_UI") {
    $kSql = "SELECT client_id, secret FROM keycloak.client WHERE client_id IN ('outline', 'n8n', 'appsmith', 'proteus-bff');"
    $kTmpSql = Join-Path $env:TEMP "kc_secrets.sql"
    [System.IO.File]::WriteAllText($kTmpSql, $kSql, [System.Text.Encoding]::UTF8)
    
    $secretsRaw = @()
    $kcRetries = 24
    while ($kcRetries -gt 0) {
        try {
            $secretsRaw = Get-Content $kTmpSql | docker compose exec -T postgres psql -U proteus -d proteus -t -A -F ',' 2>$null
            $secretsStr = $secretsRaw -join "`n"
            if ($secretsStr -match "outline" -and $secretsStr -match "proteus-bff") {
                break
            }
        } catch {}
        Start-Sleep -Seconds 5
        $kcRetries--
    }
    Remove-Item $kTmpSql -ErrorAction SilentlyContinue

    if ($secretsStr -match "outline" -and $secretsStr -match "proteus-bff") {
        $envContent = Get-Content .env -Raw -Encoding UTF8
        foreach ($line in $secretsRaw) {
            $parts = $line -split ","
            if ($parts.Length -eq 2) {
                $clientId = $parts[0].Trim()
                $secret   = $parts[1].Trim()
                if ($clientId -eq "outline")     { $envContent = $envContent -replace "OUTLINE_OIDC_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI.*",      "OUTLINE_OIDC_SECRET=$secret" }
                if ($clientId -eq "n8n")         { $envContent = $envContent -replace "N8N_OIDC_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI.*",          "N8N_OIDC_SECRET=$secret" }
                if ($clientId -eq "appsmith")    { $envContent = $envContent -replace "APPSMITH_OIDC_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI.*",     "APPSMITH_OIDC_SECRET=$secret" }
                if ($clientId -eq "proteus-bff") { $envContent = $envContent -replace "KEYCLOAK_BFF_CLIENT_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI.*", "KEYCLOAK_BFF_CLIENT_SECRET=$secret" }
            }
        }
        Set-Content .env -Value $envContent -Encoding UTF8
        docker compose restart backend outline frontend
        Write-Host "[OK] Keycloak Secrets synced successfully." -ForegroundColor Green
    } else {
        Write-Host "[WARN] Failed to sync Keycloak Secrets. Is Keycloak fully running?" -ForegroundColor Yellow
    }
}

# 9. Appsmith (Manual configuration required)
Write-Host "[INFO] Appsmith is starting..." -ForegroundColor Cyan
Write-Host "[!] Note: APPSMITH_API_KEY must be generated manually in Appsmith UI (Developer Settings)." -ForegroundColor Yellow


# 10. Print summary
Write-Host ""
Write-Host "[DONE] Proteus OS deployed successfully!" -ForegroundColor Green
Write-Host "Access the services at:"
Write-Host "------------------------------------------------------"
Write-Host "  Launchpad (Frontend) : ${scheme}://$domain$urlSuffix"
Write-Host "  Backend API Docs     : ${scheme}://$domain$urlSuffix/api/docs"
Write-Host "  SSO (Keycloak)       : ${scheme}://auth.$domain$urlSuffix"
Write-Host "  Workflow (n8n)       : ${scheme}://workflow.$domain$urlSuffix"
Write-Host "  BI `& Dashboard      : ${scheme}://analytics.$domain$urlSuffix"
Write-Host "  Low-code UI Apps     : ${scheme}://apps.$domain$urlSuffix"
Write-Host "  Knowledge Base       : ${scheme}://wiki.$domain$urlSuffix"
Write-Host "  ChatOps (Mattermost) : ${scheme}://$domain$urlSuffix/chat/"
Write-Host "  Observability        : ${scheme}://grafana.$domain$urlSuffix"
Write-Host "  Traefik Dashboard    : ${scheme}://traefik.$domain$urlSuffix"
Write-Host "------------------------------------------------------"
Write-Host "Default account: admin / admin (Keycloak)"
Write-Host "Enjoy Proteus OS!" -ForegroundColor Cyan
