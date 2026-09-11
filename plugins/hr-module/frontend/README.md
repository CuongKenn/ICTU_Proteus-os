# HR Core — Frontend (Micro-UI thật)

Source of truth: `plugins/hr-module/frontend/`
Host build: `plugins/mfe-gateway/` import trực tiếp từ đây (không copy).

```
frontend/src/
  meta.ts          → code, tên, routes (gateway đọc để dựng nav + catalog)
  types.ts         → map 1-1 với db/seed_data.sql (+ migrations/V1.1.0 emergency_contact)
  data/seed.ts     → dữ liệu mẫu (mở rộng từ db/seed_data.sql gốc)
  lib/api.ts       → BffClient (COPY NGUYÊN từ asset-module, không sửa)
  lib/repo.ts      → DATA LAYER (quan trọng, đọc dưới)
  lib/useStore.ts  → hook resolve store live/demo
  components/ui.tsx→ StatCard, Badge, Modal, Table primitives (dark theme)
  pages/*.tsx      → Dashboard, Employees, Leaves, Departments
  App.tsx          → sub-router nhận { subPath, navigate }
```

## Data layer — 2 chế độ sau cùng 1 interface async (`src/lib/repo.ts`)

- **LIVE** (`createLiveStore`): đọc thật qua `GET /api/v1/plugins/hr-module/records/*`
  (BFF proxy + session cookie, `credentials:"include"`), CRUD nhân viên qua records
  `POST/PATCH/DELETE` bảng `hr_employees`, duyệt/từ chối đơn qua `PATCH`
  `hr_leave_requests`, riêng **tạo đơn nghỉ** dispatch workflow n8n
  `wf_leave_request` qua `POST .../actions/wf_leave_request`.
  Client **KHÔNG BAO GIỜ** gửi `tenant_id` — server tự inject từ session.
  `getStore()` tự dò API (`GET records/hr_employees?limit=1`) — rớt
  (401/offline/chưa ACTIVE) thì về DEMO + banner lý do.
- **DEMO** (`createMockRepo`): seed + `localStorage` (`proteus:hr-module:v1`),
  offline, không cần login.

Khi backend thêm API mới, chỉ sửa `createLiveStore` — pages giữ nguyên.

## Thêm màn hình mới

1. Tạo `src/pages/NewPage.tsx` export component.
2. Thêm route vào `meta.ts` + switch trong `src/App.tsx`.
3. Gateway tự nhận (không cần sửa gateway).
