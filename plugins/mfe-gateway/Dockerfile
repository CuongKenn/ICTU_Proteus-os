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
RUN npm run build

# Production Stage (Nginx)
FROM nginx:alpine

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
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3001
CMD ["nginx", "-g", "daemon off;"]
