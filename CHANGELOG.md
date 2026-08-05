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



---
*Lưu ý: Dự án đang trong giai đoạn phát triển ban đầu (Proof of Concept).*

