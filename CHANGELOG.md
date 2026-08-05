# Changelog

Tất cả các thay đổi đáng chú ý của dự án **Proteus OS** sẽ được ghi chép tại file này.

Dự án tuân thủ theo nguyên tắc [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - Sắp tới
### Added
- Khởi tạo cấu trúc dự án (Monorepo Scaffolding).
- Hoàn thiện hệ thống tài liệu đặc tả (BRD, SAD, ERD, Swagger API).
- Hướng dẫn triển khai (Deployment Guide) qua Docker và Traefik.
- Giao diện phác thảo (Mockup) cho Launchpad và Marketplace.
- **[NEW]** `docs/dsl-spec.md` — Đặc tả chuẩn DX-DSL cho AI Orchestrator: cấu trúc JSON, action whitelist, effect levels, validation rules.

### Changed
- **[docs/erd.md]** Bổ sung bảng `AUDIT_LOG`, cột `status` (enum) vào `TENANT_PLUGIN`, `tenant_id` + `plugin_code_name` vào `ROLE`, audit fields vào `USER`. Thêm hướng dẫn triển khai RLS thực tế với script SQL mẫu và chiến lược migration.
- **[docs/api-swagger.yaml]** Mở rộng từ 5 lên 18+ endpoint: thêm Auth, Tenant Management, Plugin status polling, Knowledge Base (RAG), AI history, n8n callback webhook. Bổ sung đầy đủ error response schemas (400/401/403/404/500).
- **[docs/architecture.md]** Sửa lỗ hổng bảo mật: loại bỏ anti-pattern "Token trong URL", làm rõ HttpOnly Cookie flow trong SSO Sequence Diagram. Thêm section AI Orchestrator & DX-DSL. Thêm ADR-001 chốt Redis làm Event Bus (thay vì để ngỏ Redis/RabbitMQ).
- **[docs/clarification.md]** Thêm section: Keycloak ↔ PostgreSQL sync flow (First Login Hook + Event Webhook), Metabase OSS embedding workaround (thay vì Signed Embedding Enterprise), Human-in-the-loop chi tiết với ví dụ DX-DSL end-to-end.
- **[docs/deployment.md]** Thêm Observability Stack (Grafana Loki + Promtail), bảng log labels, chiến lược Backup & Recovery với Disaster Recovery Test.
- **[README.md]** Cập nhật Documentation index bổ sung link `dsl-spec.md`.

### Fixed
- Mâu thuẫn giữa `README.md` (localhost:3000) và `deployment.md` (Traefik domain): đã làm rõ README là Quick Access còn deployment.md mô tả production routing.

---
*Lưu ý: Dự án đang trong giai đoạn phát triển ban đầu (Proof of Concept).*

