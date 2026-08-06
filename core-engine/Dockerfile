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

EXPOSE 8000

# Không dùng --workers nhiều hơn 1 nếu chưa test throughput
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]


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
RUN npm run build


# ─────────────────────────────────────────────
# STAGE 3: frontend — Production image (minimal)
# Dùng Next.js standalone output — không cần node_modules đầy đủ
# ─────────────────────────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy chỉ những gì cần thiết từ builder
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static
COPY --from=frontend-builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
