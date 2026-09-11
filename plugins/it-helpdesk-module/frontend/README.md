# IT Helpdesk Module — Frontend (Micro-UI thật)

Source of truth: `plugins/it-helpdesk-module/frontend/`
Host build: `plugins/mfe-gateway/` import trực tiếp từ đây (không copy).

```
frontend/src/
  meta.ts          → id, tên, routes (gateway đọc để dựng nav + catalog)
  types.ts         → map 1-1 với migrations/V1.0.0__initial.sql
  data/seed.ts     → dữ liệu mẫu (mở rộng từ db/seed_data.sql)
  lib/repo.ts      → DATA LAYER (quan trọng, đọc dưới)
  components/ui.tsx→ StatCard, Badge, Modal, Table primitives
  pages/*.tsx      → Dashboard, Tickets (SLA), Knowledge, Sla
  App.tsx          → sub-router nhận { subPath, navigate }
```

## Data layer — 2 chế độ sau cùng 1 interface async (`src/lib/repo.ts`)

- **LIVE** (`createLiveStore`): đọc thật qua `GET /api/v1/plugins/it-helpdesk-module/records/*`
  (BFF proxy + session cookie, `credentials:"include"`), riêng **tạo ticket**
  dispatch workflow n8n `wf_ticket_create` qua `POST .../actions/wf_ticket_create`;
  chuyển trạng thái/comment ghi qua records `it_tickets` / `it_ticket_updates`;
  tri thức + SLA CRUD qua records.
  `getStore()` tự dò API — rớt (401/offline/chưa ACTIVE) thì về DEMO + banner lý do.
- **DEMO** (`createMockRepo`): seed + `localStorage`, offline, không cần login.

Khi backend thêm API mới, chỉ sửa `createLiveStore` — pages giữ nguyên.

## Thêm màn hình mới

1. Tạo `src/pages/NewPage.tsx` export component.
2. Thêm route vào `meta.ts` + switch trong `src/App.tsx`.
3. Gateway tự nhận (không cần sửa gateway).
