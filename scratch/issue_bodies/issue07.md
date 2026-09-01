## Mô tả vấn đề

`AICommandUseCase` (tầng Core Use Case) import schema từ tầng Entrypoints:

```python
from app.entrypoints.schemas.ai_command import AICommandRequest
```

Theo Clean Architecture / Hexagonal Architecture, tầng Core (Use Cases) **KHÔNG ĐƯỢC** import từ tầng Entrypoints. Dependency phải luôn hướng vào trong (Entrypoints -> Use Cases -> Domain).

## Đề xuất sửa

1. Tạo Domain Input DTO trong tầng Core:
```python
# app/core/domain/entities.py hoặc file riêng
class AICommandInput(BaseModel):
    command_id: uuid.UUID
    session_id: str
    dsl_version: str
    action: str
    effect: str
    parameters: dict | None = None
```

2. Chuyển mapping logic từ `AICommandRequest` -> `AICommandInput` vào tầng Router
3. Use Case chỉ nhận `AICommandInput` (domain entity)

## Files liên quan
- `core-engine/backend/app/core/use_cases/ai_command.py` (L22)
- `core-engine/backend/app/entrypoints/schemas/ai_command.py`

## Phân loại
- **Loại:** Architecture
- **Ưu tiên:** High
