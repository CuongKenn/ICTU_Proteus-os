# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

# Build Stage
# NOTE: docker-compose build context là ../plugins (toàn bộ thư mục plugins),
# để COPY được source of truth plugins/<code>/frontend vào gateway.
FROM node:20-alpine AS builder

WORKDIR /build/plugins/mfe-gateway
COPY mfe-gateway/package*.json ./
RUN npm ci

COPY mfe-gateway/ ./
COPY asset-module/frontend ../asset-module/frontend
COPY crm-module/frontend ../crm-module/frontend
COPY hr-module/frontend ../hr-module/frontend
COPY finance-module/frontend ../finance-module/frontend
COPY project-module/frontend ../project-module/frontend
COPY document-module/frontend ../document-module/frontend
COPY meeting-module/frontend ../meeting-module/frontend
COPY procurement-module/frontend ../procurement-module/frontend
COPY it-helpdesk-module/frontend ../it-helpdesk-module/frontend
RUN npm run build

# Production Stage (Nginx)
FROM nginx:1.27-alpine

# Copy built assets
COPY --from=builder /build/plugins/mfe-gateway/dist /usr/share/nginx/html

# Custom Nginx config for SPA routing
RUN echo 'server { \
    listen 3001; \
    server_name _; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf \
    && chown -R nginx:nginx /usr/share/nginx/html /etc/nginx/conf.d /var/cache/nginx /var/run

# Hardening: chạy nginx worker bằng user không phải root (port 3001 > 1024)
USER nginx

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
