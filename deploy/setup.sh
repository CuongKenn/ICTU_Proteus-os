#!/usr/bin/env bash
# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Proteus OS One-Click Deploy Script

set -e

echo "🚀 Bắt đầu cài đặt Proteus OS..."

# 1. Check prerequisites
for cmd in docker "docker compose" openssl curl; do
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

# 7. Print URLs
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
