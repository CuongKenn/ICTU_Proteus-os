# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Proteus OS Core Engine — Multi-stage Dockerfile
# Stage 1: backend        → FastAPI image
# Stage 2: frontend-builder → Next.js build
# Stage 3: frontend         → Production Next.js image (standalone)

# ─────────────────────────────────────────────
# STAGE 1: backend — FastAPI
# ─────────────────────────────────────────────
FROM python:3.12-slim AS backend

WORKDIR /app

# Install system dependencies (gcc cho asyncpg, libpq-dev cho psycopg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements trước để tận dụng Docker layer cache
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY backend/ .

# Hardening: chạy backend bằng user không phải root
RUN useradd -m -u 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

# Không dùng --workers nhiều hơn 1 nếu chưa test throughput
# --proxy-headers: tin tưởng X-Forwarded-* từ Traefik (đúng client IP/scheme khi qua proxy)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers"]


# ─────────────────────────────────────────────
# STAGE 2: frontend-builder — Build Next.js
# Cài cả devDependencies vì cần để build (tailwind, typescript, etc.)
# ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files trước để cache layer
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Copy toàn bộ source và build
COPY frontend/ .

ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* phải có mặt lúc build (Next.js bake vào client bundle).
# Giá trị truyền qua docker-compose build.args, có fallback cho dev.
ARG NEXT_PUBLIC_MATTERMOST_URL=http://chat.proteus.local
ARG NEXT_PUBLIC_OUTLINE_URL=http://wiki.proteus.local
ARG NEXT_PUBLIC_N8N_URL=http://workflow.proteus.local
ARG NEXT_PUBLIC_METABASE_URL=http://analytics.proteus.local
ARG NEXT_PUBLIC_APPSMITH_URL=http://apps.proteus.local
ARG NEXT_PUBLIC_KEYCLOAK_URL=http://auth.proteus.local
ENV NEXT_PUBLIC_MATTERMOST_URL=$NEXT_PUBLIC_MATTERMOST_URL
ENV NEXT_PUBLIC_OUTLINE_URL=$NEXT_PUBLIC_OUTLINE_URL
ENV NEXT_PUBLIC_N8N_URL=$NEXT_PUBLIC_N8N_URL
ENV NEXT_PUBLIC_METABASE_URL=$NEXT_PUBLIC_METABASE_URL
ENV NEXT_PUBLIC_APPSMITH_URL=$NEXT_PUBLIC_APPSMITH_URL
ENV NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL
RUN npm run build
# Verify Next.js standalone output (next.config.mjs: output "standalone")
RUN test -f .next/standalone/server.js || (echo "ERROR: standalone output missing — check next.config.mjs output:'standalone'" && exit 1)


# ─────────────────────────────────────────────
# STAGE 3: frontend — Production image (minimal)
# Dùng Next.js standalone output — không cần node_modules đầy đủ
# ─────────────────────────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next standalone bind theo $HOSTNAME; Docker mặc định gán HOSTNAME=<container-id>
# khiến server chỉ nghe trên IP eth0, healthcheck 127.0.0.1 fail → unhealthy vĩnh viễn
# → Traefik v3 lọc container unhealthy, mất router frontend (404). Bind 0.0.0.0 để fix.
ENV HOSTNAME=0.0.0.0

# Copy chỉ những gì cần thiết từ builder
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static
COPY --from=frontend-builder /app/public ./public

# Hardening: chạy frontend bằng user node có sẵn (uid 1000), không root
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null || wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
