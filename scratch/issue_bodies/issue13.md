## Mô tả vấn đề

Backend CI workflow kiểm tra Alembic migration (`alembic upgrade head`, `alembic check`), nhưng thư mục `migrations/` có thể chưa có version scripts thực sự. File `alembic.ini` tồn tại nhưng chưa rõ có migration scripts tương ứng với models trong `infrastructure/models.py`.

Models đã define đầy đủ 8+ tables (tenants, users, roles, user_roles, plugins, tenant_plugins, tenant_integrations, audit_logs, ai_commands) nhưng migration history có thể trống.

## Đề xuất sửa

1. Chạy `alembic revision --autogenerate -m "Initial schema"` để tạo migration đầu tiên
2. Verify migration script tương thích với models hiện tại
3. Thêm seed data migration cho system roles và default tenant (nếu cần)
4. Document quy trình tạo migration mới trong CONTRIBUTING.md

## Files liên quan
- `core-engine/backend/alembic.ini`
- `core-engine/backend/migrations/`
- `core-engine/backend/app/infrastructure/models.py`

## Phân loại
- **Loại:** DevOps
- **Ưu tiên:** Medium
