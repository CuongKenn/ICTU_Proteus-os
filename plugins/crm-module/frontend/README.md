# CRM Module — Frontend (Micro-UI thật)

Source of truth: `plugins/crm-module/frontend/`

## Bao gồm (deep)

- **Tổng quan**: KPI + phễu pipeline (weighted value theo `probability_pct`)
  + ticket SLA + lead theo nguồn. Map với
  `dashboards/sales_pipeline.json`, `dashboards/customer_health.json`.
- **Leads**: kanban `NEW → CONTACTED → QUALIFIED → CONVERTED/LOST`,
  chuyển stage bằng nút, convert thành Opportunity (mô phỏng
  `workflows/lead_capture.json`).
- **Cơ hội**: kanban `PROSPECTING → QUALIFICATION → PROPOSAL →
  NEGOTIATION → CLOSED_WON/CLOSED_LOST`, chỉnh probability, giá trị
  kỳ vọng = Σ value × probability (chỉ tính open).
- **Khách hàng**: list + drawer chi tiết (contacts, opportunities, tickets).
- **Tickets**: SLA countdown (`sla_deadline`), chuyển trạng thái
  `OPEN → IN_PROGRESS → WAITING_ON_CUSTOMER → RESOLVED → CLOSED`,
  thêm comment (mô phỏng `workflows/ticket_assignment.json`).

## Data layer — 2 chế độ sau cùng 1 interface async (`src/lib/repo.ts`)

- **LIVE** (`createLiveStore`): đọc thật qua `GET /api/v1/plugins/crm-module/records/*`,
  ghi CRUD qua records `POST/PATCH/DELETE`; **Thêm lead** → workflow
  `wf_lead_capture`, **Tạo ticket** → `wf_ticket_assignment` (dispatcher).
  `getStore()` tự dò API — rớt thì về DEMO + banner lý do.
- **DEMO**: seed + `localStorage`, offline, không cần login.
