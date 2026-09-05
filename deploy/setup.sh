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
    
    # 3. Auto-generate Secrets
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    sed -i.bak "s|NEXTAUTH_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL|NEXTAUTH_SECRET=$NEXTAUTH_SECRET|g" .env
    
    N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
    sed -i.bak "s|N8N_ENCRYPTION_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL|N8N_ENCRYPTION_KEY=$N8N_ENCRYPTION_KEY|g" .env
    
    OUTLINE_SECRET_KEY=$(openssl rand -hex 32)
    sed -i.bak "s|OUTLINE_SECRET_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL.*|OUTLINE_SECRET_KEY=$OUTLINE_SECRET_KEY|g" .env
    
    OUTLINE_UTILS_SECRET=$(openssl rand -hex 32)
    sed -i.bak "s|OUTLINE_UTILS_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL.*|OUTLINE_UTILS_SECRET=$OUTLINE_UTILS_SECRET|g" .env
    
    rm -f .env.bak
    echo "✅ Đã tạo .env và generate secret keys."
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
MM_URL="http://localhost/api/v4"
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
  if curl -sf -H "$MM_HOST_HEADER" $MM_URL/system/ping > /dev/null; then
    break
  fi
  sleep 5
  MM_ELAPSED=$((MM_ELAPSED + 5))
done

if [ $MM_ELAPSED -lt $MM_TIMEOUT ] && grep -q "MATTERMOST_BOT_TOKEN=CHANGE_ME_GET_FROM_MATTERMOST" .env; then
  # 7.3 Tạo Admin User đầu tiên (Bỏ qua nếu đã tạo)
  curl -sf -X POST "$MM_URL/users" \
    -H "$MM_HOST_HEADER" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "admin@proteus.local",
      "username": "sysadmin",
      "password": "'"$MM_ADMIN_PASS"'",
      "allow_marketing": false
    }' > /dev/null || true

  # 7.4 Đăng nhập lấy Auth Token
  MM_TOKEN=$(curl -si -X POST "$MM_URL/users/login" \
    -H "$MM_HOST_HEADER" \
    -H "Content-Type: application/json" \
    -d '{"login_id":"sysadmin","password":"'"$MM_ADMIN_PASS"'"}' \
    | grep -i "^token:" | awk '{print $2}' | tr -d '\r')
    
  if [ -n "$MM_TOKEN" ]; then
    # 7.5 Enable Personal Access Tokens
    curl -sf -X PUT "$MM_URL/config" \
      -H "$MM_HOST_HEADER" \
      -H "Authorization: Bearer $MM_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"ServiceSettings":{"EnableUserAccessTokens":true}}' > /dev/null

    # 7.6 Tạo Bot account (hoặc lấy ID nếu đã có)
    BOT_USER_ID=$(curl -s -X POST "$MM_URL/bots" \
      -H "$MM_HOST_HEADER" \
      -H "Authorization: Bearer $MM_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"username":"proteus-bot","display_name":"Proteus AI Bot","description":"AI Orchestrator Bot"}' \
      | jq -r '.user_id')
      
    if [ "$BOT_USER_ID" = "null" ] || [ -z "$BOT_USER_ID" ]; then
      # Lấy user ID của bot nếu đã tồn tại
      BOT_USER_ID=$(curl -s -X GET "$MM_URL/users/username/proteus-bot" -H "$MM_HOST_HEADER" -H "Authorization: Bearer $MM_TOKEN" | jq -r '.id')
    fi

    if [ -n "$BOT_USER_ID" ] && [ "$BOT_USER_ID" != "null" ]; then
      # 7.7 Tạo Personal Access Token cho Bot
      BOT_TOKEN=$(curl -sf -X POST "$MM_URL/users/$BOT_USER_ID/tokens" \
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

if [ $N8N_ELAPSED -lt $N8N_TIMEOUT ] && grep -q "N8N_API_KEY=CHANGE_ME" .env; then
  # 8.1 Tạo tài khoản Owner qua REST API ẩn
  curl -sf -X POST "$N8N_URL/rest/owner/setup"     -H "Content-Type: application/json"     -d '{
      "email": "'"$N8N_ADMIN_EMAIL"'",
      "password": "'"$N8N_ADMIN_PASSWORD"'",
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
# Thử gọi qua Traefik (auth.proteus.local) bằng cách thêm Host header nếu dùng localhost:80.
KC_URL_TRAEFIK="http://localhost:80"
HOST_HEADER="Host: auth.$DOMAIN"

KC_TIMEOUT=120
KC_ELAPSED=0
while [ $KC_ELAPSED -lt $KC_TIMEOUT ]; do
  if curl -sf -H "$HOST_HEADER" "$KC_URL_TRAEFIK/health/ready" > /dev/null; then
    break
  fi
  sleep 5
  KC_ELAPSED=$((KC_ELAPSED + 5))
done

if [ $KC_ELAPSED -lt $KC_TIMEOUT ]; then
  # Lấy Token
  KC_TOKEN=$(curl -s -X POST "$KC_URL_TRAEFIK/realms/master/protocol/openid-connect/token"     -H "$HOST_HEADER"     -d "client_id=admin-cli&grant_type=password&username=$KC_ADMIN_USER&password=$KC_ADMIN_PASS"     | jq -r '.access_token // empty')

  if [ -n "$KC_TOKEN" ]; then
    # Lấy BFF Client Secret
    if grep -q "KEYCLOAK_BFF_CLIENT_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI" .env; then
      BFF_CLIENT_ID=$(curl -s "$KC_URL_TRAEFIK/admin/realms/$KC_REALM/clients?clientId=proteus-bff"         -H "$HOST_HEADER" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[0].id // empty')
      if [ -n "$BFF_CLIENT_ID" ] && [ "$BFF_CLIENT_ID" != "null" ]; then
        BFF_SECRET=$(curl -s "$KC_URL_TRAEFIK/admin/realms/$KC_REALM/clients/$BFF_CLIENT_ID/client-secret"           -H "$HOST_HEADER" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.value // empty')
        if [ -n "$BFF_SECRET" ] && [ "$BFF_SECRET" != "null" ]; then
          sed -i.bak "s|KEYCLOAK_BFF_CLIENT_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI|KEYCLOAK_BFF_CLIENT_SECRET=$BFF_SECRET|g" .env
          echo "✅ Đã lấy KEYCLOAK_BFF_CLIENT_SECRET"
        fi
      fi
    fi

    # Lấy Outline OIDC Secret
    if grep -q "OUTLINE_OIDC_SECRET=CHANGE_ME_GET_FROM_KEYCLOAK_UI" .env; then
      OUTLINE_CLIENT_ID=$(curl -s "$KC_URL_TRAEFIK/admin/realms/$KC_REALM/clients?clientId=outline"         -H "$HOST_HEADER" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[0].id // empty')
      if [ -n "$OUTLINE_CLIENT_ID" ] && [ "$OUTLINE_CLIENT_ID" != "null" ]; then
        OUTLINE_SECRET=$(curl -s "$KC_URL_TRAEFIK/admin/realms/$KC_REALM/clients/$OUTLINE_CLIENT_ID/client-secret"           -H "$HOST_HEADER" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.value // empty')
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
