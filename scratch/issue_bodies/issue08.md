## Mô tả vấn đề

API endpoint `POST /plugins/synthesize` cho phép AI tự động sinh code Plugin dựa trên prompt. Đây là endpoint đặc biệt nguy hiểm vì:

1. Gọi LLM API tốn tài nguyên (chi phí token, thời gian xử lý)
2. Sinh code tự động và load vào server — nguy cơ code injection
3. Hiện tại không có rate limiting riêng cho endpoint này

Trong `main.py`, rate limiter chỉ được cấu hình global nhưng không có decorator cụ thể cho endpoint `/plugins/synthesize`.

## Đề xuất sửa

1. Thêm rate limiting decorator cho endpoint synthesize:
```python
@router.post("/synthesize")
@limiter.limit("3/hour")  # Tối đa 3 lần/giờ mỗi user
async def synthesize_plugin(...):
```

2. Thêm audit log cho mọi lần gọi synthesize
3. Cân nhắc thêm approval step trước khi load code tự sinh vào server
4. Sandbox execution cho code được sinh

## Files liên quan
- `core-engine/backend/app/entrypoints/routers/plugins.py` (L309-342)
- `core-engine/backend/app/ai/plugin_synthesizer.py`
- `core-engine/backend/app/infrastructure/rate_limiter.py`

## Phân loại
- **Loại:** Security
- **Ưu tiên:** High
