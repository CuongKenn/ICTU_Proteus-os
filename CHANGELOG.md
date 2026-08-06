# Changelog

Tất cả các thay đổi đáng chú ý của dự án **Proteus OS** sẽ được ghi chép tại file này.

Dự án tuân thủ theo nguyên tắc [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - Sắp tới

### Added
- **[docs/dsl-spec.md]** Đặc tả chuẩn DX-DSL cho AI Orchestrator: cấu trúc JSON, action whitelist với cột Required Role, effect levels, validation rules, approval_deadline field.
- **[docs/clarification.md §6]** Giải thích cơ chế giao tiếp liên Plugin: Loose Coupling qua Redis Pub/Sub, Event Schema chuẩn (bắt buộc tenant_id), Event Naming Convention, ví dụ end-to-end HR→Finance, khai báo `event_subscriptions` trong manifest.yaml.
- **[docs/clarification.md §7]** Phân quyền cài đặt Plugin: phân cấp 3 tầng Role (Platform/Tenant/Plugin), ma trận quyền, luồng cài đặt 2 bước, xử lý khi AI được yêu cầu cài Plugin.
- **[docs/clarification.md §9]** Tổng hợp toàn bộ AI capabilities: 3 chế độ (RAG Assistant/Proactive Monitor/Executive Agent), capability matrix theo plugin, danh sách hard limits, ranh giới AI vs. con người.
- **[docs/deployment.md §7]** Yêu cầu hạ tầng cho AI Services: Qdrant, Redis, n8n, LangChain; cấu hình LLM Provider (.env); lịch Cron cho Proactive Monitor; cảnh báo chi phí token.
- **[docs/architecture.md ADR-002]** Quyết định kiến trúc: không dùng Graph RAG ở v1.0, thay bằng Qdrant Hybrid Search (Dense Vector + BM25). Phân tích chi phí/lợi ích và điều kiện xem xét lại ở v2.0.
- **[.agents/AGENTS.md §6]** Rule mới: Quy tắc cập nhật CHANGELOG.md — bảng trigger cases, định dạng Keep a Changelog, quy tắc viết nội dung.

### Changed
- **[docs/architecture.md §2.3]** Mở rộng AI Orchestrator section: bảng 3 chế độ AI, execution flow diagram, Hard Limits note, cross-reference đến clarification.md §9.
- **[docs/architecture.md §3]** Mở rộng RBAC: liệt kê rõ 3 tầng (Platform/Tenant/Plugin), link đến clarification.md §7.
- **[docs/BRD.md FR4]** Sửa Qdrant/Milvus → Qdrant; thêm giới hạn FR4.2 (Monitor chỉ báo cáo); thêm cross-ref đến clarification.md §9.
- **[docs/BRD.md FR5]** Làm rõ "Quản trị viên" = `tenant_admin`; chỉ `tenant_admin` và `superadmin` có quyền cài Plugin.
- **[docs/erd.md §2.2]** Mở rộng mô tả bảng ROLE: bảng mini permission matrix cho 3 loại role.
- **[docs/erd.md §2.4]** Mở rộng AUDIT_LOG.actor_type: giải thích 3 giá trị (HUMAN/AI_AGENT/SYSTEM), note về trace command_id.
- **[docs/erd.md §4.3]** Sửa duplicate `CREATE POLICY` (SQL error): gộp thành 1 policy `FOR ALL` đúng, thêm `DROP POLICY IF EXISTS` hint, thêm `TO app_user`.
- **[docs/dsl-spec.md §1]** Thêm cross-reference đến clarification.md §9 ở đầu Overview.
- **[docs/dsl-spec.md §5]** Đổi JSON code block sang `jsonc` + disclaimer; thêm trường `approval_deadline` vào schema và field table.
- **[docs/api-swagger.yaml]** Thêm endpoint `POST /webhooks/keycloak/events`; thêm Required Role vào description của `/plugins/install`, `/plugins/{id}`, `/health/detailed`; fix security của `/health/detailed` (từ anonymous → auth required).
- **[docs/clarification.md §2.3]** Sửa mâu thuẫn Metabase Signed Embedding: forward đến §4 thay vì mô tả như tính năng hoạt động.
- **[docs/deployment.md §2.1]** Bổ sung routing `/files/`, `/wiki/`, `/monitoring/` cho Nextcloud, Outline, Grafana.
- **[docs/deployment.md §2.2]** Bổ sung Nextcloud, Outline, Grafana, Qdrant, Redis vào network diagram Docker.

### Fixed
- **[docs/architecture.md]** Mermaid diagram EventBus label: "Redis / RabbitMQ" → "Redis Pub/Sub" (nhất quán với ADR-001).
- **[docs/BRD.md]** Event Bus: "Redis Pub/Sub hoặc RabbitMQ" → "Redis Pub/Sub" (nhất quán với ADR-001).

### Changed (tiếp theo)
- **[docs/architecture.md §2.3]** Thêm bảng phân công rõ ràng "n8n vs. LangChain (FastAPI)" cho cả 3 chế độ AI: RAG Assistant (LangChain toàn bộ, n8n không tham gia), Proactive Monitor (n8n toàn bộ, LangChain không tham gia), Executive Agent (LangChain nửa trước reasoning + DX-DSL, n8n nửa sau execution). Giải thích lý do không thay LangChain bằng n8n AI Nodes cho production.

---

## [Unreleased] — Cập nhật GitHub Pages Landing Page (2026-08-06)

### Changed
- **[landing-page/index.html]** Viết lại toàn bộ GitHub Pages landing page với thiết kế premium Glassmorphism Dark Mode: thêm 10 sections mới (Problem, H-P-D-I, Agentic AI, Marketplace, Launchpad Preview, Tech Stack, Documentation Grid, Roadmap, Quick Start, CTA), Navbar responsive với hamburger mobile menu, Stats bar với counter animation, Footer 4 cột đầy đủ links.
- **[landing-page/styles.css]** Viết lại toàn bộ CSS bằng Vanilla CSS (loại bỏ Tailwind CDN dependency): Design Tokens CSS Variables theo Design System chuẩn, Background Orbs animation, Grid overlay pattern, tất cả component styles (Glass Card, HPDI Cards, AI Mode Cards, Tech Grid, Docs Grid, Roadmap Timeline, CTA Box, Footer), Responsive breakpoints đầy đủ (1024px, 768px, 480px), Intersection Observer reveal animations, Counter animation.

---



### Added
- **[docs/clarification.md §8]** Thêm mục mới "Quản lý Token & Phiên làm việc": bảng TTL Token (Access/Refresh/Session), luồng Silent Refresh chi tiết, Refresh Token Rotation security, xử lý khi Refresh Token hết hạn (buộc re-login), bảng edge case (5 tình huống).
- **[docs/erd.md §2.4]** Thêm bảng `AI_COMMAND` vào ERD: lưu lịch sử DX-DSL Command với đầy đủ approval workflow (approved_by, second_approver, mattermost_message_id, approval_deadline, execution_result). Giải thích lý do tách riêng khỏi `AUDIT_LOG` để query hiệu quả. Bảng trạng thái đầy đủ 6 status.
- **[docs/ui_ux_design.md §5]** Thêm Design System hoàn chỉnh: Color Palette (14 tokens Dark Mode + 4 tokens Light Mode với HSL/Hex), Typography System (font family + 7-level type scale), Spacing & Grid System (8 tokens + layout specs), Component Inventory (Button variants+states, Plugin Card wireframe+6 states, App Icon spec, Toast 4 types, AI Widget states, Loading/Empty states), Navigation Flow Diagram (Mermaid), Animation & Motion table (8 interactions).

### Changed
- **[docs/BRD.md]** Fix link broken `./docs/clarification.md §9` → `./clarification.md §9` (BRD nằm trong thư mục docs/ nên đường dẫn con trỏ sai subdirectory).
- **[docs/BRD.md §5]** Cập nhật cây thư mục `docs/`: thêm `BRD.md`, `dsl-spec.md`, `deployment.md` còn thiếu; cập nhật mô tả `architecture.md` và `api-swagger.yaml`.
- **[docs/dsl-spec.md §3.1]** Thêm cột `Required Role` vào bảng nhóm `finance` (thiếu so với bảng `core` và `hr`): `finance_viewer`, `finance_approver`, `tenant_admin` theo từng action.
- **[docs/deployment.md §2.1]** Thêm 2 route còn thiếu: `/workflow/` → n8n Admin UI, `/analytics/` → Metabase BI Dashboard.
- **[docs/deployment.md §2.2]** Thêm `n8n` và `Metabase` vào Mermaid network diagram (cả node lẫn Traefik routing và kết nối PostgreSQL).
- **[docs/api-swagger.yaml]** Thống nhất server URL Development: `http://api.proteus.local/api/v1` → `http://localhost:8000/api/v1` (nhất quán với cách truy cập development trong README.md và deployment.md).
- **[docs/clarification.md §9.4]** Thêm link ngược tham chiếu đến `docs/dsl-spec.md` tại mục CAUTION về `DSL_INVALID_ACTION`.

### Fixed
- **[docs/dsl-spec.md §6]** Fix typo "bửi" → "bởi" trong mô tả validation rule Permission check.


---
*Lưu ý: Dự án đang trong giai đoạn phát triển ban đầu (Proof of Concept).*

