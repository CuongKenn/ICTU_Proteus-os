## Mô tả vấn đề

File `core-engine/backend/app/entrypoints/routers/plugins.py` dòng 24 import:

```python
from app.core.plugin_system.models import PluginStatus
```

Nhưng module `app.core.plugin_system` **không tồn tại** trong codebase. `PluginStatus` đã được định nghĩa trong `app.core.domain.entities`. Điều này sẽ gây **ImportError** khi khởi động server.

## Đề xuất sửa

Sửa dòng import:
```python
from app.core.domain.entities import PluginStatus
```

## Files liên quan
- `core-engine/backend/app/entrypoints/routers/plugins.py` (L24)
- `core-engine/backend/app/core/domain/entities.py` — nơi `PluginStatus` thực sự được định nghĩa

## Phân loại
- **Loại:** Bug
- **Ưu tiên:** Critical — Server không thể khởi động
