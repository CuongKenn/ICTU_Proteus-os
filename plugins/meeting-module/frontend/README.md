# meeting-module frontend

Micro-frontend React+TypeScript cho plugin Quản lý Cuộc họp & Phòng họp.
Copy pattern từ `plugins/asset-module/frontend`.

## Cấu trúc

```
src/
  meta.ts            # displayName + routes (Tổng quan / Phòng họp / Đặt phòng / Việc cần làm)
  types.ts           # map 1-1 migrations (meeting_rooms/bookings/action_items/...)
  data/seed.ts       # mở rộng db/seed_data.sql (giữ 2 phòng gốc)
  lib/api.ts         # BffClient → /api/proxy (copy nguyên asset-module)
  lib/useStore.ts    # resolve live/demo + errText/reasonText
  lib/repo.ts        # MeetingStore: createDemoStore / createLiveStore / getStore
  components/ui.tsx  # primitives dark theme (copy, Badge tổng quát)
  pages/             # Dashboard, RoomsPage, BookingsPage, ActionsPage
  App.tsx            # sub-router + tabs + Reset demo (ẩn khi live)
```

## Live mapping

| Thao tác | Kênh |
|---|---|
| Đọc (rooms/bookings/actions/...) | `records/<bảng>` |
| Đặt phòng | check trùng giờ client + dispatcher `wf_meeting_booking` |
| Hủy lịch | `PATCH records/meeting_bookings/:id` |
| Action items | `records/meeting_action_items` CRUD |
| Phòng họp | `records/meeting_rooms` CRUD |

Dò live: `GET records/meeting_rooms?limit=1`. Rớt → demo (`proteus:meeting-module:v1`).
Không import ngoài React, không gửi `tenant_id`.
