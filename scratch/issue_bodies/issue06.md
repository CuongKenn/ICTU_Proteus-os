## Mô tả vấn đề

File `core-engine/backend/app/entrypoints/routers/plugins.py` dòng 95 import:

```python
from app.infrastructure.database import async_session_maker
```

Nhưng trong file `database.py`, session factory được đặt tên là `AsyncSessionLocal`, không phải `async_session_maker`. Điều này sẽ gây **ImportError** khi background task `_run_install_plugin_background` được gọi.

## Đề xuất sửa

Sửa dòng import:
```python
from app.infrastructure.database import AsyncSessionLocal
```

Và thay đổi dòng sử dụng:
```python
async with AsyncSessionLocal() as session:
```

## Files liên quan
- `core-engine/backend/app/entrypoints/routers/plugins.py` (L95-97)
- `core-engine/backend/app/infrastructure/database.py` — export `AsyncSessionLocal`

## Phân loại
- **Loại:** Bug
- **Ưu tiên:** Critical — Plugin install background task sẽ crash
