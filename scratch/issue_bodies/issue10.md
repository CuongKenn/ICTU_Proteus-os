## Mô tả vấn đề

Redis Pub/Sub hiện tại là fire-and-forget — nếu không có subscriber nào lắng nghe, event sẽ bị mất hoàn toàn (đã ghi nhận trong docstring `redis_event_bus.py`). Tuy nhiên, một số event quan trọng (plugin lifecycle events) cần đảm bảo delivery.

Cụ thể, nếu:
1. Plugin installed/uninstalled event bị mất → dependent plugins không nhận được thông báo
2. AI Command approval event bị mất → command timeout không cần thiết
3. Server restart giữa lúc publish → mất toàn bộ pending events

## Đề xuất sửa

1. Dùng Redis Streams thay vì Pub/Sub cho critical events (có persistence)
2. Implement Dead Letter Queue (DLQ) cho events publish thất bại
3. Thêm retry mechanism trong `publish()` method
4. Tách events thành 2 tầng:
   - Real-time notifications → Pub/Sub (fire-and-forget)
   - Critical lifecycle events → Redis Streams (persistent)

## Files liên quan
- `core-engine/backend/app/adapters/external/redis_event_bus.py`
- `core-engine/backend/app/core/use_cases/plugin_install.py` — nên publish event sau install
- `core-engine/backend/app/core/use_cases/plugin_uninstall.py` — nên publish event sau uninstall

## Phân loại
- **Loại:** Improvement
- **Ưu tiên:** Medium
