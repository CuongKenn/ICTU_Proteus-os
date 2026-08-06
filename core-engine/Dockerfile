# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Proteus OS Core Engine — Multi-stage Dockerfile
# Stage 1: backend  → FastAPI image
# Stage 2: frontend → Next.js image

# ─────────────────────────────────────────────
# STAGE: backend
# ─────────────────────────────────────────────
FROM python:3.12-slim AS backend

WORKDIR /app

# Install system dependencies
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

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

# ─────────────────────────────────────────────
# STAGE: frontend-deps
# ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-deps

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --only=production

# ─────────────────────────────────────────────
# STAGE: frontend-builder
# ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ .

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─────────────────────────────────────────────
# STAGE: frontend (production image)
# ─────────────────────────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone build
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static
COPY --from=frontend-builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
