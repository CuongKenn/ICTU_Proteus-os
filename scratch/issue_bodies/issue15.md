## Mô tả vấn đề

Trong `plugin_uninstall.py`:
- Dòng 7: `import re` được import nhưng chỉ dùng 1 lần trong `_step_6_database`. Tuy nhiên, import này là cần thiết.
- Dòng 8: `import uuid` được import nhưng chỉ dùng cho type hint `uuid.UUID` trong method signature — OK.

Vấn đề chính: Trong `plugin_install.py`:
- Dòng 9: `import re` được import cho validation trong `_step_1_database` — OK
- Dòng 7: `import json` dùng cho các step — OK

Tuy nhiên, trong `plugin_install.py` dòng 198:
```python
seed_path = (
    self.manifest_parser._plugins_dir  # Truy cập private attribute
    / plugin_code_name
    / manifest.database.seed_file
)
```

Và tương tự ở dòng 241, 256, 270 — đều truy cập `self.manifest_parser._plugins_dir` (private attribute với prefix `_`).

## Đề xuất sửa

1. Thêm public property `plugins_dir` vào `LocalManifestParser`:
```python
@property
def plugins_dir(self) -> Path:
    return self._plugins_dir
```

2. Hoặc tạo method `get_plugin_file_path(plugin_code_name, relative_path)` trong `LocalManifestParser`

3. Thay thế tất cả `self.manifest_parser._plugins_dir` bằng public API

## Files liên quan
- `core-engine/backend/app/core/use_cases/plugin_install.py` (L198, L241, L256, L270)
- `core-engine/backend/app/adapters/external/local_manifest_parser.py`

## Phân loại
- **Loại:** Code Quality / Encapsulation
- **Ưu tiên:** Low
