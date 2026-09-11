# Asset Module — Frontend (Micro-UI thật)

Source of truth: `plugins/asset-module/frontend/`
Host build: `plugins/mfe-gateway/` import trực tiếp từ đây (không copy).

```
frontend/src/
  meta.ts          → id, tên, routes (gateway đọc để dựng nav + catalog)
  types.ts         → map 1-1 với migrations/V1.0.0__initial.sql
  data/seed.ts     → dữ liệu mẫu (mở rộng từ db/seed_data.sql)
  lib/repo.ts      → DATA LAYER (quan trọng, đọc dưới)
  components/ui.tsx→ StatCard, Badge, Modal, Table primitives
  pages/*.tsx      → Dashboard, Assets, Maintenance, Disposals
  App.tsx          → sub-router nhận { subPath, navigate }
```

## Data layer — 2 chế độ sau cùng 1 interface async (`src/lib/repo.ts`)

- **LIVE** (`createLiveStore`): đọc thật qua `GET /api/v1/plugins/asset-module/records/*`
  (BFF proxy + session cookie, `credentials:"include"`), ghi CRUD qua records
  `POST/PATCH/DELETE`, riêng **Cấp phát** dispatch workflow n8n
  `wf_asset_request` qua `POST .../actions/wf_asset_request`.
  `getStore()` tự dò API — rớt (401/offline/chưa ACTIVE) thì về DEMO + banner lý do.
- **DEMO** (`createMockRepo`): seed + `localStorage`, offline, không cần login.

Khi backend thêm API mới, chỉ sửa `createLiveStore` — pages giữ nguyên.

## Thêm màn hình mới

1. Tạo `src/pages/NewPage.tsx` export component.
2. Thêm route vào `meta.ts` + switch trong `src/App.tsx`.
3. Gateway tự nhận (không cần sửa gateway).
