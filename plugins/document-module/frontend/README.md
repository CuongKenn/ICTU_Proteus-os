# document-module frontend

Micro-frontend React+TypeScript cho plugin Quản lý Văn bản (Document Management System).
Copy pattern từ `plugins/asset-module/frontend`.

## Cấu trúc

```
src/
  meta.ts            # displayName + routes (Tổng quan / Văn bản đến / Văn bản đi / Phê duyệt)
  types.ts           # map 1-1 migrations (document_incoming/outgoing/approvals/...)
  data/seed.ts       # mở rộng db/seed_data.sql (giữ 5 categories gốc)
  lib/api.ts         # BffClient → /api/proxy (copy nguyên asset-module)
  lib/useStore.ts    # resolve live/demo + errText/reasonText
  lib/repo.ts        # DocumentStore: createDemoStore / createLiveStore / getStore
  components/ui.tsx  # primitives dark theme (copy, Badge tổng quát)
  pages/             # Dashboard, IncomingPage, OutgoingPage, ApprovalsPage
  App.tsx            # sub-router + tabs + Reset demo (ẩn khi live)
```

## Live mapping

| Thao tác | Kênh |
|---|---|
| Đọc (incoming/outgoing/approvals/...) | `records/<bảng>` |
| Tạo văn bản đến | dispatcher `wf_incoming_document` |
| Duyệt văn bản | dispatcher `wf_document_approval` |
| Điều chuyển văn bản | dispatcher `wf_reassign_document` |
| Còn lại (sửa trạng thái, CRUD văn bản đi...) | `records` CRUD |

Dò live: `GET records/document_incoming?limit=1`. Rớt → demo (`proteus:document-module:v1`).
Không import ngoài React, không gửi `tenant_id`.
