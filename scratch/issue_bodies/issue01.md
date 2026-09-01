## Mô tả vấn đề

Trong file `core-engine/backend/app/core/use_cases/plugin_install.py` (dòng 220-222) và `plugin_uninstall.py` (dòng 274, 281, 349-354), schema name và table name được chèn trực tiếp vào câu SQL thông qua f-string mà không dùng parameterized query.

Mặc dù `schema_name` được build từ `tenant_id` (UUID) nên rủi ro thấp, nhưng `table_name` trong rollback (install L352-354) không được validate regex trước khi DROP.

## Đề xuất sửa

1. Validate tất cả identifier trước khi chèn vào SQL — dùng regex `^[a-zA-Z0-9_]+$`
2. Dùng `quote_ident()` của PostgreSQL để escape identifier an toàn
3. Tách hàm tiện ích `safe_sql_identifier()` cho toàn bộ project

## Files liên quan
- `core-engine/backend/app/core/use_cases/plugin_install.py` (L192-233, L346-355)
- `core-engine/backend/app/core/use_cases/plugin_uninstall.py` (L268-286)

## Phân loại
- **Loại:** Security
- **Ưu tiên:** Critical
