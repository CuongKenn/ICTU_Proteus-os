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

# 2. Initialize .env
$envFile = ".env"
$envExampleFile = ".env.example"

if (-Not (Test-Path $envFile)) {
    if (Test-Path $envExampleFile) {
        Write-Host "[INFO] Initializing .env from .env.example..." -ForegroundColor Yellow
        Copy-Item -Path $envExampleFile -Destination $envFile

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

        $envContent = Get-Content -Path $envFile -Raw
        $envContent = $envContent -replace "NEXTAUTH_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL",    "NEXTAUTH_SECRET=$nextAuthSecret"
        $envContent = $envContent -replace "N8N_ENCRYPTION_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL", "N8N_ENCRYPTION_KEY=$n8nEncryptionKey"
        $envContent = $envContent -replace "OUTLINE_SECRET_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL.*",   "OUTLINE_SECRET_KEY=$outlineSecretKey"
        $envContent = $envContent -replace "OUTLINE_UTILS_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL.*", "OUTLINE_UTILS_SECRET=$outlineUtilsSecret"

        Set-Content -Path $envFile -Value $envContent -Encoding UTF8

        Write-Host "[OK] .env created and secret keys generated." -ForegroundColor Green
    } else {
        Write-Host "[ERROR] .env.example not found." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[INFO] .env already exists, skipping initialization." -ForegroundColor Cyan
}

# Read DOMAIN from .env
$domain = "proteus.local"
if (Test-Path $envFile) {
    $domainLine = Get-Content -Path $envFile | Where-Object { $_ -match "^DOMAIN=" }
    if ($domainLine) {
        $domain = $domainLine.Split('=')[1].Trim('"', "'")
    }
}

# 4. Configure hosts file
if ($domain -eq "proteus.local") {
    $hostsPath = "$env:windir\System32\drivers\etc\hosts"
    $hostsEntry = "127.0.0.1 proteus.local auth.proteus.local wiki.proteus.local analytics.proteus.local apps.proteus.local workflow.proteus.local chat.proteus.local grafana.proteus.local traefik.proteus.local"

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
}

# 5. Start Docker Compose
Write-Host "[INFO] Starting services via Docker Compose..." -ForegroundColor Cyan
docker compose up -d

# 6. Wait for backend health
Write-Host "[INFO] Waiting for services to start (may take 1-2 minutes)..." -ForegroundColor Yellow
$timeout = 120
$elapsed = 0

while ($elapsed -lt $timeout) {
    try {
        $response = Invoke-WebRequest -Uri "http://$domain/health" -UseBasicParsing -ErrorAction SilentlyContinue
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
$envContent = Get-Content .env -Raw
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
    $mmUrl = "http://localhost:8065/api/v4"
    
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
    try { $loginRes = Invoke-WebRequest -Uri "$mmUrl/users/login" -Method Post -Body "{`"login_id`":`"sysadmin`",`"password`":`"$mmAdminPass`"}" -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue } catch {}
    if ($loginRes -and $loginRes.Headers["Token"]) {
        $mmToken = $loginRes.Headers["Token"]
        $headers = @{ "Authorization" = "Bearer $mmToken" }
        try { Invoke-RestMethod -Uri "$mmUrl/config" -Method Put -Body '{"ServiceSettings":{"EnableUserAccessTokens":true}}' -Headers $headers -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue | Out-Null } catch {}

        try { $botRes = Invoke-RestMethod -Uri "$mmUrl/bots" -Method Post -Body '{"username":"proteus-bot","display_name":"Proteus AI Bot","description":"AI Orchestrator Bot"}' -Headers $headers -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue } catch {}
        $botId = $botRes.user_id
        if (-not $botId) {
            try { $botRes = Invoke-RestMethod -Uri "$mmUrl/users/username/proteus-bot" -Method Get -Headers $headers -UseBasicParsing -ErrorAction SilentlyContinue } catch {}
            $botId = $botRes.id
        }

        if ($botId) {
            try { $tokenRes = Invoke-RestMethod -Uri "$mmUrl/users/$botId/tokens" -Method Post -Body '{"description":"Proteus OS Bot Token"}' -Headers $headers -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue } catch {}
            if ($tokenRes.token) {
                $envContent = Get-Content .env -Raw
                $envContent = $envContent -replace "MATTERMOST_BOT_TOKEN=CHANGE_ME_GET_FROM_MATTERMOST", "MATTERMOST_BOT_TOKEN=$($tokenRes.token)"
                Set-Content .env -Value $envContent -Encoding UTF8
                docker compose restart backend
            }
        }
    }
    }
}

# 8. Configure n8n (Create Owner + inject API Key via DB)
Write-Host "[INFO] Configuring n8n (Owner Account + API Key via DB)..." -ForegroundColor Cyan
$envContent = Get-Content .env -Raw
if ($envContent -match "N8N_API_KEY=CHANGE_ME") {
    $n8nRes = Invoke-RestWithRetry -Uri "http://workflow.$domain/rest/owner/setup" -Method Post -Body "{`"email`":`"admin@proteus.local`",`"firstName`":`"Admin`",`"lastName`":`"Proteus`",`"password`":`"$mmAdminPass`"}"
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

    # Inject via DB (PowerShell-native temp file — no bash/base64 needed)
    $sql = 'UPDATE n8n."user" SET "apiKey"=''' + $newApiKey + ''' WHERE email=''admin@proteus.local'';'
    $tmpSql = Join-Path $env:TEMP "n8n_key.sql"
    [System.IO.File]::WriteAllText($tmpSql, $sql, [System.Text.Encoding]::UTF8)
    Get-Content $tmpSql | docker compose exec -T postgres psql -U proteus -d proteus | Out-Null
    Remove-Item $tmpSql -ErrorAction SilentlyContinue

    $envContent = Get-Content .env -Raw
    $envContent = $envContent -replace "N8N_API_KEY=CHANGE_ME.*", "N8N_API_KEY=$newApiKey"
    Set-Content .env -Value $envContent -Encoding UTF8
    docker compose restart backend
    Write-Host "[OK] N8N_API_KEY injected via database." -ForegroundColor Green
}


# 8.5 Sync Keycloak OIDC Secrets from DB
Write-Host "[INFO] Syncing Keycloak OIDC Secrets..." -ForegroundColor Cyan
$envContent = Get-Content .env -Raw
if ($envContent -match "CHANGE_ME_GET_FROM_KEYCLOAK_UI") {
    $kSql = "SELECT client_id, secret FROM keycloak.client WHERE client_id IN ('outline', 'n8n', 'appsmith', 'proteus-bff');"
    $kTmpSql = Join-Path $env:TEMP "kc_secrets.sql"
    [System.IO.File]::WriteAllText($kTmpSql, $kSql, [System.Text.Encoding]::UTF8)
    $secretsRaw = Get-Content $kTmpSql | docker compose exec -T postgres psql -U proteus -d proteus -t -A -F ','
    Remove-Item $kTmpSql -ErrorAction SilentlyContinue

    $envContent = Get-Content .env -Raw
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
    docker compose restart backend outline
    Write-Host "[OK] Keycloak Secrets synced successfully." -ForegroundColor Green
}

# 9. Appsmith (login-based API key)
Write-Host "[INFO] Configuring Appsmith (Admin + API Key)..." -ForegroundColor Cyan
$appsmithUrl = "http://localhost:8080"
$envContent = Get-Content .env -Raw
$appAdminPass = ($envContent -split "`n" | Where-Object { $_ -match "^APPSMITH_ADMIN_PASSWORD=" }) -replace "APPSMITH_ADMIN_PASSWORD=", ""
$appAdminPass = $appAdminPass.Trim(" `r")

# Wait for Appsmith
$appTimeout = 180
$appElapsed = 0
while ($appElapsed -lt $appTimeout) {
    try {
        Invoke-RestMethod -Uri "$appsmithUrl/api/v1/users" -UseBasicParsing -ErrorAction Stop | Out-Null
        break
    } catch {
        Start-Sleep -Seconds 5
        $appElapsed += 5
    }
}

if ($appElapsed -lt $appTimeout -and $envContent -match "APPSMITH_API_KEY=CHANGE_ME_GET_FROM_APPSMITH") {
    # 9.1 Create Super Admin (Ignore if already created)
    $superAdminBody = '{"email":"admin@proteus.local","password":"' + $appAdminPass + '","name":"Proteus Admin","allowCollectingAnonymousData":false,"signupForNewsletter":false}'
    try {
        Invoke-RestMethod -Uri "$appsmithUrl/api/v1/users/super" -Method Post -Body $superAdminBody -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue | Out-Null
    } catch {}

    # 9.2 Login to get Session Token
    $loginBody = '{"username":"admin@proteus.local","password":"' + $appAdminPass + '"}'
    $session = $null
    try {
        Invoke-WebRequest -Uri "$appsmithUrl/api/v1/users/login" -Method Post -Body $loginBody -ContentType "application/json" -SessionVariable session -UseBasicParsing -ErrorAction SilentlyContinue | Out-Null
    } catch {}

    if ($session) {
        # 9.3 Create API Key
        try {
            $apiRes = Invoke-RestMethod -Uri "$appsmithUrl/api/v1/users/api-key" -Method Post -Body '{"label":"proteus-os-bot"}' -ContentType "application/json" -WebSession $session -UseBasicParsing -ErrorAction SilentlyContinue
            if ($apiRes -and $apiRes.data -and $apiRes.data.apiKey) {
                $envContent = $envContent -replace "APPSMITH_API_KEY=CHANGE_ME_GET_FROM_APPSMITH", "APPSMITH_API_KEY=$($apiRes.data.apiKey)"
                Set-Content .env -Value $envContent -Encoding UTF8
                Write-Host "[OK] APPSMITH_API_KEY generated and saved." -ForegroundColor Green
                docker compose restart backend
            } else {
                Write-Host "[WARN] Could not parse APPSMITH_API_KEY from response." -ForegroundColor Yellow
            }
        } catch {
            Write-Host "[WARN] Failed to generate Appsmith API key." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[WARN] Could not login to Appsmith to retrieve cookie session." -ForegroundColor Yellow
    }
}

# 10. Print summary
Write-Host ""
Write-Host "[DONE] Proteus OS deployed successfully!" -ForegroundColor Green
Write-Host "Access the services at:"
Write-Host "------------------------------------------------------"
Write-Host "  Launchpad (Frontend) : http://$domain"
Write-Host "  Backend API Docs     : http://$domain/api/docs"
Write-Host "  SSO (Keycloak)       : http://auth.$domain"
Write-Host "  Workflow (n8n)       : http://workflow.$domain"
Write-Host "  BI `& Dashboard      : http://analytics.$domain"
Write-Host "  Low-code UI Apps     : http://apps.$domain"
Write-Host "  Knowledge Base       : http://wiki.$domain"
Write-Host "  ChatOps (Mattermost) : http://$domain/chat/"
Write-Host "  Observability        : http://grafana.$domain"
Write-Host "  Traefik Dashboard    : http://traefik.$domain"
Write-Host "------------------------------------------------------"
Write-Host "Default account: admin / admin (Keycloak)"
Write-Host "Enjoy Proteus OS!" -ForegroundColor Cyan
