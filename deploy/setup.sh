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

# 2. Xử lý file .env
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "📄 Khởi tạo file .env từ .env.example..."
    cp .env.example .env
    
    # 3. Auto-generate NEXTAUTH_SECRET (and N8N_ENCRYPTION_KEY if possible)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    sed -i.bak "s|NEXTAUTH_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL|NEXTAUTH_SECRET=$NEXTAUTH_SECRET|g" .env
    
    N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
    sed -i.bak "s|N8N_ENCRYPTION_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL|N8N_ENCRYPTION_KEY=$N8N_ENCRYPTION_KEY|g" .env
    
    rm -f .env.bak
    echo "✅ Đã tạo .env và generate secret keys."
  else
    echo "❌ Lỗi: Không tìm thấy file .env.example"
    exit 1
  fi
else
  echo "ℹ️  File .env đã tồn tại, bỏ qua bước khởi tạo."
fi

# Đọc DOMAIN từ .env
DOMAIN=$(grep -E "^DOMAIN=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DOMAIN=${DOMAIN:-proteus.local}

# 4. Hướng dẫn sửa hosts file
if [ "$DOMAIN" = "proteus.local" ]; then
  echo ""
  echo "⚠️  LƯU Ý: Bạn đang dùng domain local ($DOMAIN)."
  echo "Hãy đảm bảo file hosts (/etc/hosts hoặc C:\\Windows\\System32\\drivers\\etc\\hosts) có dòng sau:"
  echo "127.0.0.1 proteus.local auth.proteus.local wiki.proteus.local analytics.proteus.local apps.proteus.local workflow.proteus.local chat.proteus.local"
  echo ""
fi

# 5. Khởi động Docker Compose
echo "🐳 Khởi động các dịch vụ qua Docker Compose..."
docker compose up -d

# 6. Wait healthchecks
echo "⏳ Đang chờ các dịch vụ khởi động (có thể mất 1-2 phút)..."
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if curl -s http://localhost:8000/api/v1/health | grep -q "status"; then
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


# 7. Tự động hóa cấu hình Mattermost
echo "⚙️  Đang cấu hình Mattermost (Tạo Bot, Webhook Secret)..."
MM_URL="http://localhost:8065"

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
  if curl -sf $MM_URL/api/v4/system/ping > /dev/null; then
    break
  fi
  sleep 5
  MM_ELAPSED=$((MM_ELAPSED + 5))
done

if [ $MM_ELAPSED -lt $MM_TIMEOUT ] && grep -q "MATTERMOST_BOT_TOKEN=CHANGE_ME_GET_FROM_MATTERMOST" .env; then
  # 7.3 Tạo Admin User đầu tiên (Bỏ qua nếu đã tạo)
  curl -sf -X POST "$MM_URL/api/v4/users"     -H "Content-Type: application/json"     -d '{
      "email": "admin@proteus.local",
      "username": "sysadmin",
      "password": "'"$MM_ADMIN_PASS"'",
      "allow_marketing": false
    }' || true

  # 7.4 Đăng nhập lấy Auth Token
  MM_TOKEN=$(curl -si -X POST "$MM_URL/api/v4/users/login"     -H "Content-Type: application/json"     -d '{"login_id":"sysadmin","password":"'"$MM_ADMIN_PASS"'"}'     | grep -i "^token:" | awk '{print $2}' | tr -d '\r')
    
  if [ -n "$MM_TOKEN" ]; then
    # 7.5 Enable Personal Access Tokens
    curl -sf -X PUT "$MM_URL/api/v4/config"       -H "Authorization: Bearer $MM_TOKEN"       -H "Content-Type: application/json"       -d '{"ServiceSettings":{"EnableUserAccessTokens":true}}'

    # 7.6 Tạo Bot account (hoặc lấy ID nếu đã có)
    BOT_USER_ID=$(curl -s -X POST "$MM_URL/api/v4/bots"       -H "Authorization: Bearer $MM_TOKEN"       -H "Content-Type: application/json"       -d '{"username":"proteus-bot","display_name":"Proteus AI Bot","description":"AI Orchestrator Bot"}'       | jq -r '.user_id')
      
    if [ "$BOT_USER_ID" = "null" ] || [ -z "$BOT_USER_ID" ]; then
      # Lấy user ID của bot nếu đã tồn tại
      BOT_USER_ID=$(curl -s -X GET "$MM_URL/api/v4/users/username/proteus-bot" -H "Authorization: Bearer $MM_TOKEN" | jq -r '.id')
    fi

    if [ -n "$BOT_USER_ID" ] && [ "$BOT_USER_ID" != "null" ]; then
      # 7.7 Tạo Personal Access Token cho Bot
      BOT_TOKEN=$(curl -sf -X POST "$MM_URL/api/v4/users/$BOT_USER_ID/tokens"         -H "Authorization: Bearer $MM_TOKEN"         -H "Content-Type: application/json"         -d '{"description":"Proteus OS Bot Token"}'         | jq -r '.token')

      if [ -n "$BOT_TOKEN" ] && [ "$BOT_TOKEN" != "null" ]; then
        sed -i.bak "s|MATTERMOST_BOT_TOKEN=CHANGE_ME_GET_FROM_MATTERMOST|MATTERMOST_BOT_TOKEN=$BOT_TOKEN|g" .env
        rm -f .env.bak
        echo "✅ Đã tạo MATTERMOST_BOT_TOKEN và ghi vào .env"
        
        # Restart backend để nạp biến mới
        docker compose restart backend
      fi
    fi
  else
    echo "⚠️ Không thể đăng nhập Mattermost bằng sysadmin để tạo bot token."
  fi
fi


# 8. Tự động hóa cấu hình n8n (Zero-Touch Provisioning)
echo "⚙️  Đang cấu hình n8n (Tạo Owner Account & API Key)..."
N8N_URL="http://localhost:5678"

# Lấy thông tin user từ .env (hoặc mặc định)
N8N_ADMIN_EMAIL="admin@proteus.local"
N8N_ADMIN_PASSWORD=$(grep -E "^POSTGRES_PASSWORD=" .env | cut -d '=' -f2) # Dùng chung password cho tiện

# Chờ n8n sẵn sàng
N8N_TIMEOUT=120
N8N_ELAPSED=0
while [ $N8N_ELAPSED -lt $N8N_TIMEOUT ]; do
  if curl -sf $N8N_URL/healthz > /dev/null; then
    break
  fi
  sleep 5
  N8N_ELAPSED=$((N8N_ELAPSED + 5))
done

if [ $N8N_ELAPSED -lt $N8N_TIMEOUT ] && grep -q "N8N_API_KEY=CHANGE_ME_GET_FROM_N8N_SETTINGS" .env; then
  # 8.1 Tạo tài khoản Owner qua REST API ẩn
  # Lưu session cookie vào file
  curl -sf -c n8n_cookie.txt -X POST "$N8N_URL/rest/owner/setup"     -H "Content-Type: application/json"     -d '{
      "email": "'"$N8N_ADMIN_EMAIL"'",
      "password": "'"$N8N_ADMIN_PASSWORD"'",
      "firstName": "Admin",
      "lastName": "Proteus"
    }' > /dev/null || true

  # 8.2 Sinh API Key (Cần CSRF Token & Cookie)
  # Đăng nhập để lấy lại cookie (nếu owner đã được tạo từ trước)
  if [ ! -s n8n_cookie.txt ]; then
    curl -sf -c n8n_cookie.txt -X POST "$N8N_URL/rest/login"       -H "Content-Type: application/json"       -d '{
        "email": "'"$N8N_ADMIN_EMAIL"'",
        "password": "'"$N8N_ADMIN_PASSWORD"'"
      }' > /dev/null || true
  fi

  if [ -s n8n_cookie.txt ]; then
    # Parse cookie authentication string
    N8N_API_KEY=$(curl -sf -b n8n_cookie.txt -X POST "$N8N_URL/rest/api-keys"       -H "Content-Type: application/json"       -d '{"label": "Proteus OS AI Orchestrator"}'       | jq -r '.data.apiKey')

    if [ -n "$N8N_API_KEY" ] && [ "$N8N_API_KEY" != "null" ]; then
      sed -i.bak "s|N8N_API_KEY=CHANGE_ME_GET_FROM_N8N_SETTINGS|N8N_API_KEY=$N8N_API_KEY|g" .env
      rm -f .env.bak
      echo "✅ Đã tạo N8N_API_KEY và ghi vào .env"
      
      # Restart backend để nạp biến mới
      docker compose restart backend
    fi
  else
    echo "⚠️ Không thể đăng nhập n8n để tạo API Key."
  fi
  rm -f n8n_cookie.txt
fi

# 9. Tự động hóa cấu hình Appsmith
echo "⚙️  Đang cấu hình Appsmith (Tạo Admin & API Key)..."
APPSMITH_URL="http://localhost:8080"
APPSMITH_ADMIN_PASS=$(grep -E "^APPSMITH_ADMIN_PASSWORD=" .env | cut -d '=' -f2)

# Chờ Appsmith sẵn sàng
APP_TIMEOUT=180
APP_ELAPSED=0
while [ $APP_ELAPSED -lt $APP_TIMEOUT ]; do
  if curl -sf $APPSMITH_URL/api/v1/users > /dev/null; then
    break
  fi
  sleep 5
  APP_ELAPSED=$((APP_ELAPSED + 5))
done

if [ $APP_ELAPSED -lt $APP_TIMEOUT ] && grep -q "APPSMITH_API_KEY=CHANGE_ME_GET_FROM_APPSMITH" .env; then
  # 9.1 Tạo Super Admin (Bỏ qua nếu đã tạo)
  curl -sf -X POST "$APPSMITH_URL/api/v1/users/super"     -H "Content-Type: application/json"     -d '{
      "email": "admin@proteus.local",
      "password": "'"$APPSMITH_ADMIN_PASS"'",
      "name": "Proteus Admin",
      "allowCollectingAnonymousData": false,
      "signupForNewsletter": false
    }' > /dev/null || true

  # 9.2 Đăng nhập lấy Session Token
  curl -sf -c /tmp/appsmith_cookie.txt -X POST "$APPSMITH_URL/api/v1/users/login"     -H "Content-Type: application/json"     -d '{"username":"admin@proteus.local","password":"'"$APPSMITH_ADMIN_PASS"'"}' > /dev/null || true

  if [ -s /tmp/appsmith_cookie.txt ]; then
    # 9.3 Tạo API Key
    APPSMITH_API_KEY=$(curl -sf -b /tmp/appsmith_cookie.txt -X POST "$APPSMITH_URL/api/v1/users/api-key"       -H "Content-Type: application/json"       -d '{"label":"proteus-os-bot"}'       | jq -r '.data.apiKey // empty')

    if [ -n "$APPSMITH_API_KEY" ] && [ "$APPSMITH_API_KEY" != "null" ]; then
      sed -i.bak "s|APPSMITH_API_KEY=CHANGE_ME_GET_FROM_APPSMITH|APPSMITH_API_KEY=$APPSMITH_API_KEY|g" .env
      rm -f .env.bak
      echo "✅ Đã tạo APPSMITH_API_KEY và ghi vào .env"
      
      # Restart backend để nạp biến mới
      docker compose restart backend
    else
      echo "⚠️ Không thể tự động lấy APPSMITH_API_KEY. Vui lòng lấy thủ công tại: http://apps.$DOMAIN"
    fi
  else
    echo "⚠️ Không thể đăng nhập Appsmith để lấy cookie. Vui lòng lấy thủ công tại: http://apps.$DOMAIN"
  fi
  rm -f /tmp/appsmith_cookie.txt
fi



# 9. Print URLs
echo ""
echo "🎉 Proteus OS triển khai hoàn tất!"
echo "Truy cập các dịch vụ tại:"
echo "------------------------------------------------------"
echo "👉 Launchpad (Frontend): http://$DOMAIN"
echo "👉 Backend API Docs    : http://$DOMAIN/api/docs"
echo "👉 SSO (Keycloak)      : http://auth.$DOMAIN"
echo "👉 Workflow (n8n)      : http://workflow.$DOMAIN"
echo "👉 BI & Dashboard      : http://analytics.$DOMAIN"
echo "👉 Low-code UI Apps    : http://apps.$DOMAIN"
echo "👉 Knowledge Base      : http://wiki.$DOMAIN"
echo "👉 ChatOps (Mattermost): http://$DOMAIN/chat/"
echo "👉 Observability (Grafana): http://grafana.$DOMAIN"
echo "👉 Traefik Dashboard   : http://traefik.$DOMAIN"
echo "------------------------------------------------------"
echo "Tài khoản mặc định: admin / admin (Keycloak)"
echo "Chúc bạn sử dụng Proteus OS hiệu quả!"
