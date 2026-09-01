## Mô tả vấn đề

Trong `plugin_install.py` dòng 225-228, `SET LOCAL role` và `SET LOCAL app.current_tenant` sử dụng f-string trực tiếp:

```python
await self.session.execute(text("SET LOCAL role = 'tenant_admin'"))
await self.session.execute(text(f"SET LOCAL app.current_tenant = '{context.tenant_id}'"))
```

Mặc dù `context.tenant_id` là UUID, nhưng pattern này không nhất quán với cách xử lý trong `database.py` (dòng 67-69) — nơi đã dùng parameterized statement đúng cách:

```python
connection.execute(
    text("SELECT set_config('app.current_tenant_id', :tid, true)"),
    {"tid": validated},
)
```

## Đề xuất sửa

1. Thống nhất dùng `set_config()` với bind params trong toàn bộ codebase
2. Tạo utility function `set_tenant_context(session, tenant_id)` dùng chung
3. Audit toàn bộ codebase cho các trường hợp dùng f-string trong SQL

## Files liên quan
- `core-engine/backend/app/core/use_cases/plugin_install.py` (L225-228)
- `core-engine/backend/app/infrastructure/database.py` (L67-69) — đã làm đúng

## Phân loại
- **Loại:** Security
- **Ưu tiên:** Critical
