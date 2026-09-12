#!/usr/bin/env bash
# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Proteus OS One-Click Deploy Script

set -e

echo "🚀 Bắt đầu cài đặt Proteus OS..."

# 1. Check prerequisites
for cmd in docker "docker compose" openssl curl jq; do
  if ! command -v $cmd &> /dev/null && ! $cmd version &> /dev/null; then
    echo "❌ Lỗi: Yêu cầu cài đặt '$cmd' để chạy script này."
    exit 1
  fi
done
echo "✅ Prerequisites OK."

cd "$(dirname "$0")"

# ─────────────────────────────────────────────
# Helper: ghi KEY=VALUE vào .env (sửa tại chỗ, append nếu chưa có)
# ─────────────────────────────────────────────
set_env() {
  local key="$1" value="$2" esc
  esc=$(printf '%s' "$value" | sed -e 's/[\\&|]/\\&/g')
  if [ -f .env ] && grep -qE "^${key}=" .env; then
    sed -i.bak "s|^${key}=.*|${key}=${esc}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

# Áp URL public (http/https + domain) cho frontend theo mode
apply_public_urls() {
  set_env NEXT_PUBLIC_MATTERMOST_URL "$PUBLIC_SCHEME://chat.$DOMAIN$URL_SUFFIX"
  set_env NEXT_PUBLIC_OUTLINE_URL "$PUBLIC_SCHEME://wiki.$DOMAIN$URL_SUFFIX"
  set_env NEXT_PUBLIC_N8N_URL "$PUBLIC_SCHEME://workflow.$DOMAIN$URL_SUFFIX"
  set_env NEXT_PUBLIC_METABASE_URL "$PUBLIC_SCHEME://analytics.$DOMAIN$URL_SUFFIX"
  set_env NEXT_PUBLIC_APPSMITH_URL "$PUBLIC_SCHEME://apps.$DOMAIN$URL_SUFFIX"
}

# ─────────────────────────────────────────────
# 0. Chọn chế độ triển khai: local dev hay production VPS
# ─────────────────────────────────────────────
echo ""
echo "Chọn chế độ triển khai:"
echo "  1) Local dev   — proteus.local, HTTP (máy dev/laptop)"
echo "  2) Production  — domain thật, HTTPS + Let's Encrypt (VPS)"
EXISTING_MODE=$(grep -E "^APP_MODE=" .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
DEFAULT_CHOICE=1
if [ "$EXISTING_MODE" = "production" ]; then DEFAULT_CHOICE=2; fi
read -p "Lựa chọn [1/2, mặc định: $DEFAULT_CHOICE]: " MODE_CHOICE
MODE_CHOICE=${MODE_CHOICE:-$DEFAULT_CHOICE}
if [ "$MODE_CHOICE" = "2" ]; then
  APP_MODE="production"
else
  APP_MODE="local"
fi

if [ "$APP_MODE" = "production" ]; then
  PUBLIC_SCHEME="https"
  COMPOSE_FILES="docker-compose.yml:docker-compose.prod.yml"
  OUTLINE_FORCE_HTTPS="true"
  N8N_PROTOCOL="https"
  N8N_SECURE_COOKIE="true"
  KEYCLOAK_MODE="start --optimized"
  TRAEFIK_BASE="https://localhost"
  CURL_K="-k"
  SCHEME="https"
else
  PUBLIC_SCHEME="http"
  COMPOSE_FILES="docker-compose.yml"
  OUTLINE_FORCE_HTTPS="false"
  N8N_PROTOCOL="http"
  N8N_SECURE_COOKIE="false"
  KEYCLOAK_MODE="start-dev"
  TRAEFIK_BASE="http://localhost"
  CURL_K=""
  SCHEME="http"
fi
echo "→ Chế độ: $APP_MODE (scheme: $PUBLIC_SCHEME)"

# DOMAIN: hỏi mỗi lần chạy để hỗ trợ đổi mode / đổi domain
CURRENT_DOMAIN=$(grep -E "^DOMAIN=" .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
if [ "$APP_MODE" = "production" ]; then
  DOMAIN_DEFAULT="$CURRENT_DOMAIN"
  case "$DOMAIN_DEFAULT" in *.local|"") DOMAIN_DEFAULT="";; esac
  while true; do
    if [ -n "$DOMAIN_DEFAULT" ]; then
      read -p "Domain production (VD: proteus.example.com) [$DOMAIN_DEFAULT]: " DOMAIN_INPUT
      DOMAIN_INPUT=${DOMAIN_INPUT:-$DOMAIN_DEFAULT}
    else
      read -p "Domain production (VD: proteus.example.com): " DOMAIN_INPUT
    fi
    # Chuẩn hóa: bỏ scheme và trailing slash nếu user paste URL
    DOMAIN_INPUT=$(printf '%s' "$DOMAIN_INPUT" | sed -e 's#^https\?://##' -e 's#/$##')
    if [ -z "$DOMAIN_INPUT" ]; then echo "❌ Domain không được để trống."; continue; fi
    case "$DOMAIN_INPUT" in
      *.local) echo "❌ Production không dùng *.local. Nhập domain thật đã trỏ DNS về VPS."; continue;;
    esac
    DOMAIN="$DOMAIN_INPUT"; break
  done
  CURRENT_LE=$(grep -E "^LETSENCRYPT_EMAIL=" .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
  case "$CURRENT_LE" in *@example.com|"") CURRENT_LE="";; esac
  LE_DEFAULT=${CURRENT_LE:-admin@$DOMAIN}
  read -p "Email Let's Encrypt [$LE_DEFAULT]: " LE_INPUT
  LETSENCRYPT_EMAIL=${LE_INPUT:-$LE_DEFAULT}
  # Host port cho Traefik (mặc định 80/443). Đổi khi trùng app khác trên VPS.
  CUR_HTTP_PORT=$(grep -E "^TRAEFIK_HTTP_PORT=" .env 2>/dev/null | cut -d '=' -f2 | tr -d ' ')
  CUR_HTTPS_PORT=$(grep -E "^TRAEFIK_HTTPS_PORT=" .env 2>/dev/null | cut -d '=' -f2 | tr -d ' ')
  read -p "Host port HTTP (Traefik, Let's Encrypt cần 80) [${CUR_HTTP_PORT:-80}]: " HTTP_PORT_INPUT
  read -p "Host port HTTPS (Traefik) [${CUR_HTTPS_PORT:-443}]: " HTTPS_PORT_INPUT
  HTTP_PORT=${HTTP_PORT_INPUT:-${CUR_HTTP_PORT:-80}}
  HTTPS_PORT=${HTTPS_PORT_INPUT:-${CUR_HTTPS_PORT:-443}}
  # Hậu tố port cho URL public (rỗng với port chuẩn 443)
  if [ "$HTTPS_PORT" != "443" ]; then URL_SUFFIX=":$HTTPS_PORT"; else URL_SUFFIX=""; fi
else
  DOMAIN_SUGGEST=${CURRENT_DOMAIN:-proteus.local}
  read -p "DOMAIN [$DOMAIN_SUGGEST]: " DOMAIN_INPUT
  DOMAIN=${DOMAIN_INPUT:-$DOMAIN_SUGGEST}
  LETSENCRYPT_EMAIL="admin@example.com"
  HTTP_PORT=80
  HTTPS_PORT=443
  URL_SUFFIX=""
fi
echo "→ Domain: $DOMAIN (HTTP :$HTTP_PORT, HTTPS :$HTTPS_PORT)"

# 2. Xử lý file .env
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "📄 Khởi tạo file .env từ .env.example..."
    cp .env.example .env

    # Áp chế độ vừa chọn vào .env mới
    set_env APP_MODE "$APP_MODE"
    set_env DOMAIN "$DOMAIN"
    set_env PUBLIC_SCHEME "$PUBLIC_SCHEME"
    set_env COMPOSE_FILE "$COMPOSE_FILES"
    set_env LETSENCRYPT_EMAIL "$LETSENCRYPT_EMAIL"
    set_env OUTLINE_FORCE_HTTPS "$OUTLINE_FORCE_HTTPS"
    set_env N8N_PROTOCOL "$N8N_PROTOCOL"
    set_env N8N_SECURE_COOKIE "$N8N_SECURE_COOKIE"
    set_env KEYCLOAK_START_MODE "$KEYCLOAK_MODE"
    set_env TRAEFIK_HTTP_PORT "$HTTP_PORT"
    set_env TRAEFIK_HTTPS_PORT "$HTTPS_PORT"
    set_env PUBLIC_URL_SUFFIX "$URL_SUFFIX"
    apply_public_urls
    
    echo "Thiết lập các thông tin tài khoản (Nhấn Enter để dùng giá trị mặc định/ngẫu nhiên):"
    read -p "POSTGRES_USER [proteus]: " pg_user
    pg_user=${pg_user:-proteus}
    sed -i.bak "s|POSTGRES_USER=proteus|POSTGRES_USER=$pg_user|g" .env

    read -p "POSTGRES_PASSWORD [random]: " pg_pass
    pg_pass=${pg_pass:-$(openssl rand -hex 12)}
    sed -i.bak "s|POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD_HERE|POSTGRES_PASSWORD=$pg_pass|g" .env
    
    read -p "REDIS_PASSWORD [random]: " redis_pass
    redis_pass=${redis_pass:-$(openssl rand -hex 12)}
    sed -i.bak "s|REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD_HERE|REDIS_PASSWORD=$redis_pass|g" .env

    read -p "KEYCLOAK_ADMIN_USER [admin]: " kc_user
    kc_user=${kc_user:-admin}
    sed -i.bak "s|KEYCLOAK_ADMIN_USER=admin|KEYCLOAK_ADMIN_USER=$kc_user|g" .env

    read -p "KEYCLOAK_ADMIN_PASSWORD [random]: " kc_pass
    kc_pass=${kc_pass:-$(openssl rand -hex 12)}
    sed -i.bak "s|KEYCLOAK_ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASSWORD_HERE|KEYCLOAK_ADMIN_PASSWORD=$kc_pass|g" .env

    read -p "MATTERMOST_ADMIN_PASSWORD [random]: " mm_pass
    mm_pass=${mm_pass:-$(openssl rand -hex 12)}
    sed -i.bak "s|MATTERMOST_ADMIN_PASSWORD=CHANGE_ME_STRONG_PASSWORD_HERE_123|MATTERMOST_ADMIN_PASSWORD=$mm_pass|g" .env

    read -p "APPSMITH_ADMIN_PASSWORD [random]: " appsmith_pass
    appsmith_pass=${appsmith_pass:-$(openssl rand -hex 12)}
    sed -i.bak "s|APPSMITH_ADMIN_PASSWORD=CHANGE_ME_STRONG_PASSWORD_HERE|APPSMITH_ADMIN_PASSWORD=$appsmith_pass|g" .env
    
    # 3. Auto-generate Secrets
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    sed -i.bak "s|NEXTAUTH_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL|NEXTAUTH_SECRET=$NEXTAUTH_SECRET|g" .env
    
    N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
    sed -i.bak "s|N8N_ENCRYPTION_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL|N8N_ENCRYPTION_KEY=$N8N_ENCRYPTION_KEY|g" .env

    MB_SECRET_KEY=$(openssl rand -hex 32)
    sed -i.bak "s|METABASE_SECRET_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL|METABASE_SECRET_KEY=$MB_SECRET_KEY|g" .env
    
    OUTLINE_SECRET_KEY=$(openssl rand -hex 32)
    sed -i.bak "s|OUTLINE_SECRET_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL.*|OUTLINE_SECRET_KEY=$OUTLINE_SECRET_KEY|g" .env
    
    OUTLINE_UTILS_SECRET=$(openssl rand -hex 32)
    sed -i.bak "s|OUTLINE_UTILS_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL.*|OUTLINE_UTILS_SECRET=$OUTLINE_UTILS_SECRET|g" .env
    
    rm -f .env.bak
    echo "✅ Đã tạo .env và generate secret keys."
  else
    echo "❌ Lỗi: Không tìm thấy file .env.example"
    exit 1
  fi
else
  echo "ℹ️  File .env đã tồn tại — áp chế độ '$APP_MODE' vào cấu hình hiện có."
  set_env APP_MODE "$APP_MODE"
  set_env DOMAIN "$DOMAIN"
  set_env PUBLIC_SCHEME "$PUBLIC_SCHEME"
  set_env COMPOSE_FILE "$COMPOSE_FILES"
  set_env LETSENCRYPT_EMAIL "$LETSENCRYPT_EMAIL"
  set_env OUTLINE_FORCE_HTTPS "$OUTLINE_FORCE_HTTPS"
  set_env N8N_PROTOCOL "$N8N_PROTOCOL"
  set_env N8N_SECURE_COOKIE "$N8N_SECURE_COOKIE"
  set_env KEYCLOAK_START_MODE "$KEYCLOAK_MODE"
  set_env TRAEFIK_HTTP_PORT "$HTTP_PORT"
  set_env TRAEFIK_HTTPS_PORT "$HTTPS_PORT"
  set_env PUBLIC_URL_SUFFIX "$URL_SUFFIX"
  apply_public_urls
  # Bù secret cho .env cũ từ phiên bản trước (không đụng giá trị thật)
  if grep -q "METABASE_SECRET_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL" .env; then
    set_env METABASE_SECRET_KEY "$(openssl rand -hex 32)"
    echo "✅ Đã sinh METABASE_SECRET_KEY còn thiếu."
  fi
  rm -f .env.bak
fi

# 3. Render traefik static config theo mode.
# (Static config của Traefik KHÔNG đọc biến môi trường, nên phải sinh file
# vật lý từ template. File mount vào container là traefik/traefik.yml.)
if [ "$APP_MODE" = "production" ]; then
  LE_ESC=$(printf '%s' "$LETSENCRYPT_EMAIL" | sed -e 's/[\\&|]/\\&/g')
  sed "s|__LETSENCRYPT_EMAIL__|${LE_ESC}|" traefik/traefik.prod.yml > traefik/traefik.yml
  echo "✅ Đã render traefik.yml (production, Let's Encrypt: $LETSENCRYPT_EMAIL)."
else
  cp traefik/traefik.dev.yml traefik/traefik.yml
fi

# Đọc DOMAIN từ .env
DOMAIN=$(grep -E "^DOMAIN=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DOMAIN=${DOMAIN:-proteus.local}

# 4. Local DNS (dev) hoặc preflight DNS/ports (production)
case "$DOMAIN" in
  *.local)
    echo ""
    echo "⚠️  LƯU Ý: Bạn đang dùng domain local ($DOMAIN)."
    echo "Hãy đảm bảo file hosts (/etc/hosts hoặc C:\\Windows\\System32\\drivers\\etc\\hosts) có dòng sau:"
    echo "127.0.0.1 proteus.local auth.proteus.local wiki.proteus.local analytics.proteus.local apps.proteus.local workflow.proteus.local chat.proteus.local grafana.proteus.local traefik.proteus.local plugins.proteus.local"
    echo ""
    ;;
  *)
    echo ""
    echo "🔍 Preflight production cho $DOMAIN ..."
    DNS_OK=1
    if command -v getent >/dev/null 2>&1; then
      # Grafana KHÔNG cần subdomain (chạy path /monitoring/ trên domain gốc)
      for h in "$DOMAIN" "auth.$DOMAIN" "wiki.$DOMAIN" "analytics.$DOMAIN" "apps.$DOMAIN" "workflow.$DOMAIN" "chat.$DOMAIN" "plugins.$DOMAIN" "traefik.$DOMAIN"; do
        if ! getent hosts "$h" >/dev/null 2>&1; then
          echo "⚠️  Chưa phân giải được $h — hãy trỏ DNS về IP VPS trước khi tiếp tục."
          DNS_OK=0
        fi
      done
      if [ "$DNS_OK" = "1" ]; then echo "✅ DNS OK (mọi subdomain đều phân giải được)."; fi
    else
      echo "ℹ️  Bỏ qua kiểm tra DNS (thiếu lệnh getent)."
    fi
    if command -v ss >/dev/null 2>&1; then
      for p in "$HTTP_PORT" "$HTTPS_PORT"; do
        if ss -ltn 2>/dev/null | grep -q ":$p "; then
          echo "⚠️  Port $p đang bận — Traefik cần bind $HTTP_PORT/$HTTPS_PORT."
        else
          echo "✅ Port $p trống."
        fi
      done
    fi
    if [ "$HTTP_PORT" != "80" ]; then
      echo "⚠️  Host port HTTP khác 80 → Let's Encrypt HTTP challenge KHÔNG chạy được."
      echo "   Lấy chứng chỉ thủ công (DNS challenge) rồi mount vào Traefik, hoặc giải phóng port 80."
    fi
    echo "ℹ️  Mở firewall cho $HTTP_PORT/$HTTPS_PORT (VD: ufw allow $HTTP_PORT,$HTTPS_PORT/tcp), giữ các port khác đóng."
    echo ""
    ;;
esac

# 5. Khởi động Docker Compose
echo "🐳 Khởi động các dịch vụ qua Docker Compose..."
docker compose up -d --build
# Static config của Traefik chỉ nạp lúc (re)start — restart để nhận
# traefik.yml vừa render (quan trọng khi đổi mode local <-> production).
docker compose restart traefik

# 6. Wait healthchecks
echo "⏳ Đang chờ các dịch vụ khởi động (có thể mất 1-2 phút)..."
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if curl $CURL_K -s -H "Host: $DOMAIN" $TRAEFIK_BASE/health | grep -q "status"; then
    echo "✅ Backend đã sẵn sàng!"
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "⚠️  Cảnh báo: Hết thời gian chờ backend khởi động (120s)."
  echo "Vui lòng kiểm tra log: docker compose logs backend"
fi

# 6.1 Ensure databases exist (Outline, Metabase)
echo "ℹ️  Ensuring databases exist (outline, metabase)..."
echo "SELECT 'CREATE DATABASE outline' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'outline')\gexec" | docker compose exec -T postgres psql -U proteus -d postgres > /dev/null 2>&1 || true
echo "SELECT 'CREATE DATABASE metabase' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'metabase')\gexec" | docker compose exec -T postgres psql -U proteus -d postgres > /dev/null 2>&1 || true
docker compose restart outline metabase

# 7. Tự động hóa cấu hình Mattermost
echo "⚙️  Đang cấu hình Mattermost (Tạo Bot, Webhook Secret)..."
MM_URL="$TRAEFIK_BASE/api/v4"
MM_HOST_HEADER="Host: chat.$DOMAIN"

# 7.1 Sinh MATTERMOST_WEBHOOK_SECRET
if grep -q "MATTERMOST_WEBHOOK_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL" .env; then
  MATTERMOST_WEBHOOK_SECRET=$(openssl rand -hex 32)
  sed -i.bak "s|MATTERMOST_WEBHOOK_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL|MATTERMOST_WEBHOOK_SECRET=$MATTERMOST_WEBHOOK_SECRET|g" .env
  rm -f .env.bak
  echo "✅ Đã tạo MATTERMOST_WEBHOOK_SECRET"
fi

# 7.2 Lấy MATTERMOST_ADMIN_PASSWORD
MM_ADMIN_PASS=$(grep -E "^MATTERMOST_ADMIN_PASSWORD=" .env | cut -d '=' -f2)

# Chờ Mattermost sẵn sàng
MM_TIMEOUT=120
MM_ELAPSED=0
while [ $MM_ELAPSED -lt $MM_TIMEOUT ]; do
  if curl $CURL_K -sf -H "$MM_HOST_HEADER" $MM_URL/system/ping > /dev/null; then
    break
  fi
  sleep 5
  MM_ELAPSED=$((MM_ELAPSED + 5))
done

if [ $MM_ELAPSED -lt $MM_TIMEOUT ] && grep -q "MATTERMOST_BOT_TOKEN=CHANGE_ME_GET_FROM_MATTERMOST" .env; then
  # 7.3 Tạo Admin User đầu tiên (Bỏ qua nếu đã tạo)
  curl $CURL_K -sf -X POST "$MM_URL/users" \
    -H "$MM_HOST_HEADER" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "admin@proteus.local",
      "username": "sysadmin",
      "password": "'"$MM_ADMIN_PASS"'",
      "allow_marketing": false
    }' > /dev/null || true

  # 7.4 Đăng nhập lấy Auth Token
  MM_TOKEN=$(curl $CURL_K -si -X POST "$MM_URL/users/login" \
    -H "$MM_HOST_HEADER" \
    -H "Content-Type: application/json" \
    -d '{"login_id":"sysadmin","password":"'"$MM_ADMIN_PASS"'"}' \
    | grep -i "^token:" | awk '{print $2}' | tr -d '\r')
    
  if [ -n "$MM_TOKEN" ]; then
    # 7.5 Enable Personal Access Tokens
    curl $CURL_K -s -H "$MM_HOST_HEADER" -H "Authorization: Bearer $MM_TOKEN" "$MM_URL/config" > /tmp/mm_config.json
    jq '.ServiceSettings.EnablePersonalAccessTokens = true | .ServiceSettings.EnableBotAccountCreation = true |
        .GitLabSettings.Enable = true |
        .GitLabSettings.Secret = "mattermost-secret" |
        .GitLabSettings.Id = "mattermost" |
        .GitLabSettings.AuthEndpoint = "'"$SCHEME"'://auth.'"$DOMAIN$URL_SUFFIX"'/realms/proteus/protocol/openid-connect/auth" |
        .GitLabSettings.TokenEndpoint = "'"$SCHEME"'://auth.'"$DOMAIN$URL_SUFFIX"'/realms/proteus/protocol/openid-connect/token" |
        .GitLabSettings.UserAPIEndpoint = "'"$SCHEME"'://auth.'"$DOMAIN$URL_SUFFIX"'/realms/proteus/protocol/openid-connect/userinfo"' \
        /tmp/mm_config.json > /tmp/mm_config_new.json
    curl $CURL_K -sf -X PUT "$MM_URL/config" \
      -H "$MM_HOST_HEADER" \
      -H "Authorization: Bearer $MM_TOKEN" \
      -H "Content-Type: application/json" \
      -d @/tmp/mm_config_new.json > /dev/null

    # 7.6 Tạo Bot account (hoặc lấy ID nếu đã có)
    BOT_USER_ID=$(curl $CURL_K -s -X POST "$MM_URL/bots" \
      -H "$MM_HOST_HEADER" \
      -H "Authorization: Bearer $MM_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"username":"proteus-bot","display_name":"Proteus AI Bot","description":"AI Orchestrator Bot"}' \
      | jq -r '.user_id')
      
    if [ "$BOT_USER_ID" = "null" ] || [ -z "$BOT_USER_ID" ]; then
      # Lấy user ID của bot nếu đã tồn tại
      BOT_USER_ID=$(curl $CURL_K -s -X GET "$MM_URL/users/username/proteus-bot" -H "$MM_HOST_HEADER" -H "Authorization: Bearer $MM_TOKEN" | jq -r '.id')
    fi

    if [ -n "$BOT_USER_ID" ] && [ "$BOT_USER_ID" != "null" ]; then
      # 7.7 Tạo Personal Access Token cho Bot
      BOT_TOKEN=$(curl $CURL_K -sf -X POST "$MM_URL/users/$BOT_USER_ID/tokens" \
        -H "$MM_HOST_HEADER" \
        -H "Authorization: Bearer $MM_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"description":"Proteus OS Bot Token"}' \
        | jq -r '.token')

      if [ -n "$BOT_TOKEN" ] && [ "$BOT_TOKEN" != "null" ]; then
        sed -i.bak "s|MATTERMOST_BOT_TOKEN=CHANGE_ME_GET_FROM_MATTERMOST|MATTERMOST_BOT_TOKEN=$BOT_TOKEN|g" .env
        rm -f .env.bak
        echo "✅ Đã tạo MATTERMOST_BOT_TOKEN và ghi vào .env"
        
        # Restart backend để nạp biến mới
        docker compose restart backend
      fi
    fi

    # 7.8 Tự động điền MATTERMOST_SYSTEM_CHANNEL_ID (Town Square của team đầu tiên)
    if grep -q "MATTERMOST_SYSTEM_CHANNEL_ID=CHANGE_ME_GET_FROM_MATTERMOST" .env; then
      FIRST_TEAM=$(curl $CURL_K -s -H "$MM_HOST_HEADER" -H "Authorization: Bearer $MM_TOKEN" \
        "$MM_URL/teams" | jq -r '.[0].id // empty')
      if [ -n "$FIRST_TEAM" ]; then
        TOWN_ID=$(curl $CURL_K -s -H "$MM_HOST_HEADER" -H "Authorization: Bearer $MM_TOKEN" \
          "$MM_URL/teams/$FIRST_TEAM/channels/name/town-square" | jq -r '.id // empty')
        if [ -n "$TOWN_ID" ]; then
          sed -i.bak "s|MATTERMOST_SYSTEM_CHANNEL_ID=CHANGE_ME_GET_FROM_MATTERMOST|MATTERMOST_SYSTEM_CHANNEL_ID=$TOWN_ID|g" .env
          rm -f .env.bak
          echo "✅ Đã điền MATTERMOST_SYSTEM_CHANNEL_ID và ghi vào .env"
          docker compose restart backend
        else
          echo "⚠️ Không tìm thấy kênh Town Square — giữ nguyên MATTERMOST_SYSTEM_CHANNEL_ID."
        fi
      else
        echo "⚠️ Chưa có team Mattermost nào — giữ nguyên MATTERMOST_SYSTEM_CHANNEL_ID."
      fi
    fi
  else
    echo "⚠️ Không thể đăng nhập Mattermost bằng sysadmin để tạo bot token."
  fi
fi



# 8. Tự động hóa cấu hình n8n (Zero-Touch Provisioning)
echo "⚙️  Đang cấu hình n8n (Tạo Owner Account & API Key)..."
N8N_URL="$TRAEFIK_BASE"
N8N_HOST_HEADER="Host: workflow.$DOMAIN"

# Lấy thông tin user từ .env (hoặc mặc định)
N8N_ADMIN_EMAIL="admin@proteus.local"
N8N_ADMIN_PASSWORD=$(grep -E "^POSTGRES_PASSWORD=" .env | cut -d '=' -f2) # Dùng chung password cho tiện

# Chờ n8n sẵn sàng
N8N_TIMEOUT=120
N8N_ELAPSED=0
while [ $N8N_ELAPSED -lt $N8N_TIMEOUT ]; do
  if curl $CURL_K -sf -H "$N8N_HOST_HEADER" $TRAEFIK_BASE/healthz > /dev/null; then
    break
  fi
  sleep 5
  N8N_ELAPSED=$((N8N_ELAPSED + 5))
done

if [ $N8N_ELAPSED -lt $N8N_TIMEOUT ] && grep -q "N8N_API_KEY=CHANGE_ME" .env; then
  # 8.1 Tạo tài khoản Owner qua REST API ẩn
  # n8n yêu cầu password phải có ít nhất 1 chữ hoa
  N8N_ADMIN_PASSWORD_COMPLIANT="Admin_${N8N_ADMIN_PASSWORD}!"
  curl $CURL_K -sf -X POST "$N8N_URL/rest/owner/setup" \
    -H "$N8N_HOST_HEADER" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "'"$N8N_ADMIN_EMAIL"'",
      "password": "'"$N8N_ADMIN_PASSWORD_COMPLIANT"'",
      "firstName": "Admin",
      "lastName": "Proteus"
    }' > /dev/null || true
    
  echo "✅ Đã khởi tạo n8n Owner."
  
  # 8.2 Inject API Key via Database bypass for n8n 1.52+
  NEW_N8N_API_KEY=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9')
  echo "UPDATE n8n.\"user\" SET \"apiKey\"='$NEW_N8N_API_KEY' WHERE email='admin@proteus.local';" | docker compose exec -T postgres psql -U proteus -d proteus > /dev/null || true
  
  sed -i.bak "s|N8N_API_KEY=CHANGE_ME.*|N8N_API_KEY=$NEW_N8N_API_KEY|g" .env
  rm -f .env.bak
  echo "✅ Đã tạo N8N_API_KEY qua Database."
  docker compose restart backend
fi

# 8.5 Sync Keycloak OIDC Secrets
echo "⚙️  Đang đồng bộ Keycloak OIDC Secrets..."
if grep -q "CHANGE_ME_GET_FROM_KEYCLOAK_UI" .env; then
  SECRETS=$(echo "SELECT client_id, secret FROM keycloak.client WHERE client_id IN ('outline', 'n8n', 'appsmith', 'proteus-bff');" | docker compose exec -T postgres psql -U proteus -d proteus -t -A -F ',')
  
  while IFS=, read -r client_id secret; do
    if [ "$client_id" = "outline" ]; then
      sed -i.bak "s|OUTLINE_OIDC_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI.*|OUTLINE_OIDC_SECRET=$secret|g" .env
    elif [ "$client_id" = "n8n" ]; then
      sed -i.bak "s|N8N_OIDC_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI.*|N8N_OIDC_SECRET=$secret|g" .env
    elif [ "$client_id" = "appsmith" ]; then
      sed -i.bak "s|APPSMITH_OIDC_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI.*|APPSMITH_OIDC_SECRET=$secret|g" .env
    elif [ "$client_id" = "proteus-bff" ]; then
      sed -i.bak "s|KEYCLOAK_BFF_CLIENT_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI.*|KEYCLOAK_BFF_CLIENT_SECRET=$secret|g" .env
    fi
  done <<< "$SECRETS"
  
  rm -f .env.bak
  docker compose restart backend outline
  echo "✅ Đã đồng bộ Keycloak Secrets thành công."
fi

# 9. Tự động hóa cấu hình Appsmith
echo "⚙️  Đang cấu hình Appsmith (Tạo Admin & API Key)..."
APPSMITH_URL="http://localhost:8080"
APPSMITH_ADMIN_PASS=$(grep -E "^APPSMITH_ADMIN_PASSWORD=" .env | cut -d '=' -f2)

# Chờ Appsmith sẵn sàng
APP_TIMEOUT=180
APP_ELAPSED=0
while [ $APP_ELAPSED -lt $APP_TIMEOUT ]; do
  if curl $CURL_K -sf $APPSMITH_URL/api/v1/users > /dev/null; then
    break
  fi
  sleep 5
  APP_ELAPSED=$((APP_ELAPSED + 5))
done

if [ $APP_ELAPSED -lt $APP_TIMEOUT ] && grep -q "APPSMITH_API_KEY=CHANGE_ME_GET_FROM_APPSMITH" .env; then
  # 9.1 Tạo Super Admin (Bỏ qua nếu đã tạo)
  curl $CURL_K -sf -X POST "$APPSMITH_URL/api/v1/users/super"     -H "Content-Type: application/json"     -d '{
      "email": "admin@proteus.local",
      "password": "'"$APPSMITH_ADMIN_PASS"'",
      "name": "Proteus Admin",
      "allowCollectingAnonymousData": false,
      "signupForNewsletter": false
    }' > /dev/null || true

  # 9.2 Đăng nhập lấy Session Token
  curl $CURL_K -sf -c /tmp/appsmith_cookie.txt -X POST "$APPSMITH_URL/api/v1/users/login"     -H "Content-Type: application/json"     -d '{"username":"admin@proteus.local","password":"'"$APPSMITH_ADMIN_PASS"'"}' > /dev/null || true

  if [ -s /tmp/appsmith_cookie.txt ]; then
    # 9.3 Tạo API Key
    APPSMITH_API_KEY=$(curl $CURL_K -sf -b /tmp/appsmith_cookie.txt -X POST "$APPSMITH_URL/api/v1/users/api-key"       -H "Content-Type: application/json"       -d '{"label":"proteus-os-bot"}'       | jq -r '.data.apiKey // empty')

    if [ -n "$APPSMITH_API_KEY" ] && [ "$APPSMITH_API_KEY" != "null" ]; then
      sed -i.bak "s|APPSMITH_API_KEY=CHANGE_ME_GET_FROM_APPSMITH|APPSMITH_API_KEY=$APPSMITH_API_KEY|g" .env
      rm -f .env.bak
      echo "✅ Đã tạo APPSMITH_API_KEY và ghi vào .env"
      
      # Restart backend để nạp biến mới
      docker compose restart backend
    else
      echo "⚠️ Không thể tự động lấy APPSMITH_API_KEY. Vui lòng lấy thủ công tại: $SCHEME://apps.$DOMAIN"
    fi
  else
    echo "⚠️ Không thể đăng nhập Appsmith để lấy cookie. Vui lòng lấy thủ công tại: $SCHEME://apps.$DOMAIN"
  fi
  rm -f /tmp/appsmith_cookie.txt
fi




# 10. Tự động hóa lấy Keycloak Secrets và Outline Secrets
echo "⚙️  Đang lấy Keycloak Secrets và cấu hình Outline..."

# Sinh Outline secrets
if grep -q "OUTLINE_SECRET_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL" .env; then
  OUTLINE_SECRET_KEY=$(openssl rand -hex 32)
  OUTLINE_UTILS_SECRET=$(openssl rand -hex 32)
  sed -i.bak "s|OUTLINE_SECRET_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL|OUTLINE_SECRET_KEY=$OUTLINE_SECRET_KEY|g" .env
  sed -i.bak "s|OUTLINE_UTILS_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL|OUTLINE_UTILS_SECRET=$OUTLINE_UTILS_SECRET|g" .env
  rm -f .env.bak
  echo "✅ Đã sinh OUTLINE_SECRET_KEY và OUTLINE_UTILS_SECRET"
fi

KC_ADMIN_USER=$(grep -E "^KEYCLOAK_ADMIN_USER=" .env | cut -d '=' -f2)
KC_ADMIN_PASS=$(grep -E "^KEYCLOAK_ADMIN_PASSWORD=" .env | cut -d '=' -f2)
KC_REALM=$(grep -E "^KEYCLOAK_REALM=" .env | cut -d '=' -f2)
KC_URL="http://localhost:8080" # Gọi trực tiếp tới container keycloak qua port 8080 (cần đảm bảo port 8080 được expose hoặc dùng docker exec)

# Thực tế Keycloak có thể không expose port 8080 ra host, nếu chạy trên host không gọi được localhost:8080.
# Keycloak 26+ chuyển /health sang management port — poll discovery endpoint
# (ổn định mọi version) thay vì /health/ready.
KC_DISCOVERY_PATH="/realms/master/.well-known/openid-configuration"
KC_URL_TRAEFIK="$TRAEFIK_BASE"
HOST_HEADER="Host: auth.$DOMAIN"

KC_TIMEOUT=120
KC_ELAPSED=0
while [ $KC_ELAPSED -lt $KC_TIMEOUT ]; do
  if curl $CURL_K -sf -H "$HOST_HEADER" "$KC_URL_TRAEFIK$KC_DISCOVERY_PATH" > /dev/null; then
    break
  fi
  sleep 5
  KC_ELAPSED=$((KC_ELAPSED + 5))
done

if [ $KC_ELAPSED -lt $KC_TIMEOUT ]; then
  # Lấy Token
  KC_TOKEN=$(curl $CURL_K -s -X POST "$KC_URL_TRAEFIK/realms/master/protocol/openid-connect/token"     -H "$HOST_HEADER"     -d "client_id=admin-cli&grant_type=password&username=$KC_ADMIN_USER&password=$KC_ADMIN_PASS"     | jq -r '.access_token // empty')

  if [ -n "$KC_TOKEN" ]; then
    # Lấy BFF Client Secret
    if grep -q "KEYCLOAK_BFF_CLIENT_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI" .env; then
      BFF_CLIENT_ID=$(curl $CURL_K -s "$KC_URL_TRAEFIK/admin/realms/$KC_REALM/clients?clientId=proteus-bff"         -H "$HOST_HEADER" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[0].id // empty')
      if [ -n "$BFF_CLIENT_ID" ] && [ "$BFF_CLIENT_ID" != "null" ]; then
        BFF_SECRET=$(curl $CURL_K -s "$KC_URL_TRAEFIK/admin/realms/$KC_REALM/clients/$BFF_CLIENT_ID/client-secret"           -H "$HOST_HEADER" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.value // empty')
        if [ -n "$BFF_SECRET" ] && [ "$BFF_SECRET" != "null" ]; then
          sed -i.bak "s|KEYCLOAK_BFF_CLIENT_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI|KEYCLOAK_BFF_CLIENT_SECRET=$BFF_SECRET|g" .env
          echo "✅ Đã lấy KEYCLOAK_BFF_CLIENT_SECRET"
        fi
      fi
    fi

    # Lấy Outline OIDC Secret
    if grep -q "OUTLINE_OIDC_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI" .env; then
      OUTLINE_CLIENT_ID=$(curl $CURL_K -s "$KC_URL_TRAEFIK/admin/realms/$KC_REALM/clients?clientId=outline"         -H "$HOST_HEADER" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[0].id // empty')
      if [ -n "$OUTLINE_CLIENT_ID" ] && [ "$OUTLINE_CLIENT_ID" != "null" ]; then
        OUTLINE_SECRET=$(curl $CURL_K -s "$KC_URL_TRAEFIK/admin/realms/$KC_REALM/clients/$OUTLINE_CLIENT_ID/client-secret"           -H "$HOST_HEADER" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.value // empty')
        if [ -n "$OUTLINE_SECRET" ] && [ "$OUTLINE_SECRET" != "null" ]; then
          sed -i.bak "s|OUTLINE_OIDC_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI|OUTLINE_OIDC_SECRET=$OUTLINE_SECRET|g" .env
          echo "✅ Đã lấy OUTLINE_OIDC_SECRET"
        fi
      fi
    fi
    
    rm -f .env.bak
    
    # Restart Frontend và Outline
    docker compose restart frontend outline
  else
    echo "⚠️ Không thể đăng nhập vào Keycloak Admin CLI để lấy Secret. Vui lòng kiểm tra lại KEYCLOAK_ADMIN_PASSWORD."
  fi
fi



# 9. Print URLs
echo ""
echo "🎉 Proteus OS triển khai hoàn tất!"
echo "Truy cập các dịch vụ tại:"
echo "------------------------------------------------------"
echo "👉 Launchpad (Frontend): $SCHEME://$DOMAIN$URL_SUFFIX"
echo "👉 Backend API Docs    : $SCHEME://$DOMAIN$URL_SUFFIX/api/docs"
echo "👉 SSO (Keycloak)      : $SCHEME://auth.$DOMAIN$URL_SUFFIX"
echo "👉 Workflow (n8n)      : $SCHEME://workflow.$DOMAIN$URL_SUFFIX"
echo "👉 BI & Dashboard      : $SCHEME://analytics.$DOMAIN$URL_SUFFIX"
echo "👉 Low-code UI Apps    : $SCHEME://apps.$DOMAIN$URL_SUFFIX"
echo "👉 Knowledge Base      : $SCHEME://wiki.$DOMAIN$URL_SUFFIX"
echo "👉 ChatOps (Mattermost): $SCHEME://$DOMAIN$URL_SUFFIX/chat/"
echo "👉 Observability (Grafana): $SCHEME://grafana.$DOMAIN$URL_SUFFIX"
echo "👉 Traefik Dashboard   : $SCHEME://traefik.$DOMAIN$URL_SUFFIX"
echo "------------------------------------------------------"
echo "Tài khoản mặc định: admin / admin (Keycloak)"
echo "Chúc bạn sử dụng Proteus OS hiệu quả!"
