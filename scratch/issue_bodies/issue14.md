## Mô tả vấn đề

Trong `mattermost_adapter.py` dòng 55, parameter `extra_context` thiếu proper type hint:

```python
async def send_interactive_message(
    self, channel_id: str, text: str, action_id: str, extra_context: dict = None
) -> dict[str, Any]:
```

Theo Python best practices và PEP 484:
- `dict = None` nên là `dict[str, Any] | None = None`
- Mutable default argument (`dict = None` thực ra OK vì nó là `None`, nhưng type hint không chính xác)

## Đề xuất sửa

```python
async def send_interactive_message(
    self, channel_id: str, text: str, action_id: str, extra_context: dict[str, Any] | None = None
) -> dict[str, Any]:
```

## Files liên quan
- `core-engine/backend/app/adapters/external/mattermost_adapter.py` (L55)

## Phân loại
- **Loại:** Code Quality
- **Ưu tiên:** Low
