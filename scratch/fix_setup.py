import re
import os

env_path = 'deploy/.env.example'
with open(env_path, 'r', encoding='utf-8') as f:
    env_content = f.read()

# Add MATTERMOST_ADMIN_PASSWORD to .env.example
if 'MATTERMOST_ADMIN_PASSWORD' not in env_content:
    env_content = re.sub(
        r'(# MATTERMOST\n# ─────────────────────────────────────────────)',
        r'\1\nMATTERMOST_ADMIN_PASSWORD=CHANGE_ME_STRONG_PASSWORD_HERE',
        env_content
    )
    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(env_content)

setup_path = 'deploy/setup.sh'
with open(setup_path, 'r', encoding='utf-8') as f:
    setup_content = f.read()

# Add jq to prerequisites
if 'jq' not in setup_content:
    setup_content = setup_content.replace('openssl curl;', 'openssl curl jq;')

# Add Mattermost setup logic
mattermost_logic = """
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
  curl -sf -X POST "$MM_URL/api/v4/users" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "admin@proteus.local",
      "username": "sysadmin",
      "password": "'"$MM_ADMIN_PASS"'",
      "allow_marketing": false
    }' || true

  # 7.4 Đăng nhập lấy Auth Token
  MM_TOKEN=$(curl -si -X POST "$MM_URL/api/v4/users/login" \
    -H "Content-Type: application/json" \
    -d '{"login_id":"sysadmin","password":"'"$MM_ADMIN_PASS"'"}' \
    | grep -i "^token:" | awk '{print $2}' | tr -d '\\r')
    
  if [ -n "$MM_TOKEN" ]; then
    # 7.5 Enable Personal Access Tokens
    curl -sf -X PUT "$MM_URL/api/v4/config" \
      -H "Authorization: Bearer $MM_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"ServiceSettings":{"EnableUserAccessTokens":true}}'

    # 7.6 Tạo Bot account (hoặc lấy ID nếu đã có)
    BOT_USER_ID=$(curl -s -X POST "$MM_URL/api/v4/bots" \
      -H "Authorization: Bearer $MM_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"username":"proteus-bot","display_name":"Proteus AI Bot","description":"AI Orchestrator Bot"}' \
      | jq -r '.user_id')
      
    if [ "$BOT_USER_ID" = "null" ] || [ -z "$BOT_USER_ID" ]; then
      # Lấy user ID của bot nếu đã tồn tại
      BOT_USER_ID=$(curl -s -X GET "$MM_URL/api/v4/users/username/proteus-bot" -H "Authorization: Bearer $MM_TOKEN" | jq -r '.id')
    fi

    if [ -n "$BOT_USER_ID" ] && [ "$BOT_USER_ID" != "null" ]; then
      # 7.7 Tạo Personal Access Token cho Bot
      BOT_TOKEN=$(curl -sf -X POST "$MM_URL/api/v4/users/$BOT_USER_ID/tokens" \
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

# 8. Print URLs"""

if 'Tự động hóa cấu hình Mattermost' not in setup_content:
    setup_content = setup_content.replace('# 7. Print URLs', mattermost_logic)
    with open(setup_path, 'w', encoding='utf-8') as f:
        f.write(setup_content)
    print("Updated setup.sh successfully")
else:
    print("setup.sh already updated")
