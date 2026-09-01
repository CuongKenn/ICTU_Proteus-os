## Mô tả vấn đề

Trong `deploy/docker-compose.yml` dòng 82, Keycloak được cấu hình với:

```yaml
command: start-dev --import-realm   # Đổi thành "start" + TLS khi production
```

Mode `start-dev`:
- Tắt HTTPS hoàn toàn
- Tắt hostname verification
- Bật các development features không an toàn
- **KHÔNG phù hợp cho production hay staging**

Comment ghi "Đổi thành start + TLS khi production" nhưng không có biến môi trường để chuyển đổi.

## Đề xuất sửa

1. Dùng environment variable để chuyển mode:
```yaml
command: ${KEYCLOAK_START_MODE:-start-dev} --import-realm
```

2. Trong `.env.example`, document rõ:
```
# Development: start-dev (default)
# Production: start --optimized
KEYCLOAK_START_MODE=start-dev
```

3. Cấu hình TLS cho production:
```yaml
environment:
  KC_HTTPS_CERTIFICATE_FILE: /opt/keycloak/conf/cert.pem
  KC_HTTPS_CERTIFICATE_KEY_FILE: /opt/keycloak/conf/key.pem
```

4. Thêm documentation trong `docs/deployment.md` về production hardening

## Files liên quan
- `deploy/docker-compose.yml` (L82)
- `deploy/.env.example`

## Phân loại
- **Loại:** DevOps / Security
- **Ưu tiên:** High
