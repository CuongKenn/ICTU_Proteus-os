# Changelog

Tất cả các thay đổi đáng chú ý của dự án **Proteus OS** sẽ được ghi chép tại file này.

Dự án tuân thủ theo nguyên tắc [Semantic Versioning](https://semver.org/spec/v2.0.0.html) và định dạng [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased] — Foundation Scaffolding v0.1.0 (2026-08-06)
### Fixed
- **[core-engine/backend/app/infrastructure/config.py]** Bổ sung biến môi trường `FRONTEND_URL` vào cấu hình backend để khắc phục lỗi thiếu thuộc tính khi `ProactiveMonitorAgent` hoạt động (Issue #280).
- **[core-engine/backend/app/core/use_cases/plugin_install.py]** Fix SQL injection risk bằng cách cấm các lệnh SQL nguy hiểm bổ sung. Cấu hình schema `search_path` để sandbox SQL cho từng tenant. Bổ sung database rollback (DROP TABLE) trong quá trình cài đặt plugin (Issue #281).
### Added
- **[core-engine/backend/app/entrypoints/routers/plugins.py]** Thêm endpoint `POST /api/v1/plugins/{plugin_id}/credentials` và tính năng cấu hình n8n Credentials trực tiếp từ UI (Issue #246).
- **[docs/IEEE_PAPER_DRAFT.md]** Đột phá 4 (IEEE Paper): Đóng gói bản thảo báo cáo khoa học (IEEE Format) về AI Autonomous Plugin Synthesizer & Z3 Formal Verification. Xây dựng bộ Benchmark 500 Test Cases mô phỏng tấn công RLS Boundary & suy luận ảo giác từ LLM (Issue #238).
- **[core-engine/backend/app/ai]** Đột phá 3 (IEEE Paper): Phát triển cơ chế giao tiếp liên tiến trình KV-Cache Vector IPC trên Event Bus (Redis) và Vector DB (Qdrant). Khắc phục tình trạng thắt nút cổ chai băng thông và giảm hàng triệu LLM tokens khi Multi-Agent tương tác (Issue #237).
- **[core-engine/backend]** Đột phá 2 (IEEE Paper): Phát triển AI Autonomous Plugin Synthesizer tích hợp khả năng Dynamic Hot-Reload qua `importlib.reload` và tự động đồng bộ giao diện Appsmith (Issue #236).
- **[core-engine/backend/app/core/formal_verification]** Đột phá 1 (IEEE Paper): Nhúng thành công thư viện Z3 SMT Solver để thực hiện Kiểm chứng tĩnh (Static Formal Verification) toán học cho DX-DSL. Ngăn chặn triệt để lỗi logic về RLS Tenant Boundary và các quy tắc tài chính trước khi thực thi (Issue #235).
- **[plugins/crm-module]** Khởi tạo cấu trúc scaffolding cho plugin Quản lý Quan hệ Khách hàng (crm-module) bao gồm manifest, database migrations, n8n workflows và Appsmith UI (Issue #195).
- **[plugins/project-module]** Khởi tạo cấu trúc scaffolding cho plugin Quản lý Dự án (project-module) bao gồm manifest, database migrations, n8n workflows và Appsmith UI (Issue #193).
- **[plugins/finance-module]** Khởi tạo cấu trúc scaffolding cho plugin Quản lý Tài chính Kế toán (finance-module) bao gồm manifest, database migrations, n8n workflows và Appsmith UI (Issue #190).
- **[plugins/hr-module]** Hoàn thiện cấu trúc plugin Quản lý Nhân sự (hr-module): đồng bộ schema, bổ sung tính năng chấm công, bảng lương và onboarding tasks (Issue #191).
- **[plugins/asset-module]** Khởi tạo cấu trúc scaffolding cho plugin Quản lý Tài sản Thiết bị (asset-module) bao gồm manifest, database migrations, n8n workflows và Appsmith UI (Issue #196).
- **[plugins/meeting-module]** Khởi tạo cấu trúc scaffolding cho plugin Quản lý Cuộc họp Phòng họp (meeting-module) bao gồm manifest, database migrations, n8n workflows và Appsmith UI (Issue #197).
- **[plugins/it-helpdesk-module]** Khởi tạo cấu trúc scaffolding cho plugin IT Service Desk nội bộ (it-helpdesk-module) bao gồm manifest, database migrations, n8n workflows và Appsmith UI (Issue #198).
- **[plugins/procurement-module]** Khởi tạo cấu trúc scaffolding cho plugin Quản lý Mua sắm & Hợp đồng (procurement-module) bao gồm manifest, database migrations, n8n workflows và Appsmith UI (Issue #192).

- **[plugins/document-module]** Khởi tạo cấu trúc scaffolding cho plugin Quản lý Văn bản (document-module) bao gồm manifest, database migrations, n8n workflows và Appsmith UI (Issue #194).

- **[core-engine/backend/app/infrastructure/models.py]** Thêm các ORM Models cho bảng Tenants, Users, Roles, Plugins, AI Commands.
- **[core-engine/backend/migrations]** Khởi tạo cấu hình Alembic và file migration đầu tiên cho DB Schema.
- **[core-engine/backend/app/adapters/repositories]** Thêm Abstract Classes và SQLAlchemy Repositories implementation cho User và Role.
- **[core-engine/backend]** Implement `MattermostAdapter` và `/webhooks/mattermost/callback` for Interactive Message integration (approve/reject).
- **[core-engine/frontend/src/lib/authOptions.ts]** Bổ sung cơ chế Silent Refresh token an toàn trong JWT callback. Thêm logic rotate refresh_token khi nhận token mới.
- **[core-engine/frontend/src/store/authStore.ts]** Fix type safety cho Zustand store bằng `StateCreator`, loại bỏ kiểu `any`.
- **[core-engine/backend/app/entrypoints/routers/health.py]** Cải thiện health check: Dùng `engine.connect()` trực tiếp thay vì `Depends(get_db)` để tránh chiếm connection từ pool khi Traefik/Docker healthcheck polling liên tục.
- **[core-engine/backend/app/core/domain/exceptions.py]** Refactor `ProteusBaseException` để hỗ trợ truyền `message` linh hoạt, tự động sinh chuỗi lỗi chuẩn cho logging thay vì class rỗng.
- **[deploy/docker-compose.yml]** Bổ sung cấu hình CORS cho Backend và Priority cho Traefik router; cấu hình lại Keycloak healthcheck dependency cho Backend khởi động an toàn. Thêm ghi chú cấu hình `search_path` cho Outline.
- **[core-engine/frontend/tailwind.config.ts]** Mở rộng đường dẫn `content` quét toàn bộ thư mục `src/` thay vì các thư mục cụ thể để tránh sót CSS (trong hooks/store/lib).
- **[core-engine/frontend/next.config.ts]** Tối ưu hóa cấu hình bằng cách xoá bỏ khối `experimental` rỗng không cần thiết, giữ nguyên output `standalone`.
- **[core-engine/backend/app/infrastructure/config.py]** Thêm các biến cấu hình cho Metabase, Mattermost, Appsmith (METABASE_URL, MATTERMOST_URL, APPSMITH_URL, MATTERMOST_BOT_TOKEN, etc.).
- **[deploy/.env.example]** Thêm biến cấu hình cho Metabase, Mattermost, Appsmith.
- **[docs/api-swagger.yaml]** Hoàn thiện OpenAPI 3.1 Spec cho toàn bộ endpoints (BRD NFR4: API First). Bổ sung định nghĩa `422 ValidationError` và `500 InternalServerError` cho các endpoint.
- **[deploy/docker-compose.yml]** Thêm ngăn xếp giám sát (Observability Stack) bao gồm Promtail, Loki, và Grafana.
- **[deploy/promtail]** Thêm cấu hình Promtail để thu thập logs từ Docker Socket.
- **[deploy/grafana/provisioning]** Tự động cấp phép Datasource Loki và Dashboard mặc định cho Grafana.
- **[core-engine/backend]** Sửa lỗi `MattermostAdapter` không tái sử dụng HTTP Client, gây lãng phí tài nguyên connection pool (Issue #173).
- **[core-engine/frontend]** Tách mock data (`MOCK_RESPONSES`) trong `useAICommand` sang file riêng (`__mocks__/useAICommand.mock.ts`) và sử dụng dynamic import, ngăn chặn việc bundle dữ liệu giả và giảm dung lượng bundle ở production (Issue #176).

- **[core-engine/frontend]** Bổ sung các trang placeholder cho các route còn thiếu (`/chat`, `/files`, `/wiki`, `/settings`) để khắc phục lỗi 404 khi truy cập từ thanh điều hướng (Issue #179).

- **[core-engine/backend]** Xóa tham số `request: Request = None` không sử dụng trong `dependencies.py` để tuân thủ chuẩn typing (Issue #184).

- **[core-engine/frontend]** Sửa lỗi gọi sai API endpoint trong `useMarketplace` (`/plugins` thay vì `/plugins/marketplace`) và cập nhật type schema response để danh sách Plugin load đúng từ backend (Issue #180).

- **[core-engine/frontend]** Cập nhật `AIChatWidget` phân tách chức năng của nút Thu nhỏ (chỉ ẩn panel) và nút Đóng (reset toàn bộ tin nhắn), sửa lỗi UI gọi chung 1 hàm `closeWidget` (Issue #175).

- **[core-engine/backend]** Fix lỗi vi phạm Hexagonal Architecture tại `RAGIngestionUseCase`: chuyển việc khởi tạo `OutlineAdapter` và `QdrantAdapter` từ Router sang Dependency Injection Container (Issue #169).

- **[core-engine/frontend]** Cập nhật `AIChatWidget` thêm thuộc tính `aria-live` và `role="log"` giúp tương thích với Screen Reader (WCAG 2.1) (Issue #174).

- **[core-engine/backend]** Bổ sung error handling (try/catch), logging, và tự động gửi thông báo (alert) qua Mattermost cho các APScheduler background jobs (`run_plugin_cleanup`, `run_ai_timeout_worker`) để tránh silent failures (Issue #181).

- **[core-engine/backend]** Bổ sung `SoftDeleteMixin` (`deleted_at`) cho `AuditLogModel` và `UserRoleModel` để tuân thủ quy tắc dữ liệu cốt lõi (Issue #178).

- **[core-engine/frontend]** Khắc phục lỗi Memory leak trong `useMarketplace`: đảm bảo `setInterval` được clear đúng cách khi unmount component hoặc khi cài đặt lại plugin (Issue #170).
- **[core-engine/backend]** Fix lỗi Plugin write use cases (`Install`, `Uninstall`, `Upgrade`) sử dụng read-only DB session, dẫn đến transaction không được commit và dữ liệu không persist (Issue #168).
- **[core-engine/backend]** Triển khai toàn bộ logic thực thi cho `PluginInstallUseCase` (Issue #167): 
  - Tích hợp `n8n_adapter`, `metabase_adapter`, `appsmith_adapter`, `keycloak_adapter` vào bước cài đặt plugin thay vì để `pass` như trước.
  - Sửa lỗi phantom install: thu thập `created_assets` ID trong quá trình chạy.
  - Implement logic `_rollback` thực sự bằng cách gọi các hàm `delete_*` theo thứ tự ngược lại nếu có lỗi xảy ra.

- **[core-engine/backend]** Refactor: Loại bỏ code kiểm tra RBAC (Quyền) lặp lại ở 5 API endpoints trong `plugins.py`, chuyển sang dùng `require_permission` từ `dependencies.py` (Issue #172).
- **[core-engine/frontend]** Cập nhật `next-auth` type definition để hỗ trợ `roles` an toàn, loại bỏ ép kiểu `as any` tại `AppShell.tsx` (Issue #171).

- **[core-engine/frontend]** Implement Custom Hooks (`usePlugins`, `useMarketplace`, `useSession`, `useDraftRestore`) (PR #159)
- **[core-engine/backend]** `AITimeoutWorker` — Tự động hủy AI commands chưa duyệt quá hạn (PR #158)
- **[core-engine/frontend]** Fix lỗi BFF proxy gọi sai endpoint `/ai/execute` thay vì `/ai/command` khiến AI Chat Widget bị lỗi 404 (Issue #161)
- **[core-engine/backend]** Fix SQL Injection trong `PluginInstallUseCase._step_1_database` bằng Regex Validation cấm lệnh nguy hiểm (DROP, DELETE, UPDATE, TRUNCATE)

- **[core-engine/backend]** Fix lỗi SQL Injection tiềm ẩn trong RLS Middleware bằng cách dùng UUID validation và parameterized query `set_config` (Issue #166)
- **[core-engine/backend]** Fix lỗi app crash khi khởi động do thiếu import `AbstractAICommandRepository` trong `dependencies.py` (Issue #165)
- **[core-engine/frontend]** Thêm Next.js API Routes làm BFF proxy (`/api/plugins`, `/api/plugins/install`, `/api/plugins/[id]/uninstall`) để ẩn token JWT khỏi trình duyệt và proxy request sang FastAPI backend an toàn.
- **[core-engine/backend]** `AI Command Use Case` (Read, Write, Critical paths) (PR #156)
- **[core-engine/frontend]** Cập nhật `usePlugins.ts` để gọi trực tiếp các BFF proxy routes mới thay vì sử dụng proxy generic.
- **[core-engine/backend]** `Plugin Toggle Use Case` & `Plugin Upgrade Use Case` (PR #149)
- **[core-engine/backend]** Full API Endpoints cho Plugins (PR #150)
- **[core-engine/backend]** `Permission Middleware` (PR #146)
- **[core-engine/backend]** `Plugin Uninstall Use Case (6-step reverse)` (PR #145)
- **[core-engine/backend]** `Plugin Install Use Case (6-step Saga)` (PR #141)
- **[core-engine/backend]** `Tenant Onboarding Use Case` (PR #143)
- **[core-engine/backend]** API `POST /webhooks/keycloak/events` (Webhook xử lý vô hiệu hóa user) (PR #138)
- **[core-engine/backend]** `Plugin Cleanup Agent (APScheduler background job)` (PR #152)

### Added
- **[core-engine/backend/app/adapters/repositories/plugin_repo.py]** Hoàn thiện implementation cho `SQLAlchemyPluginRepository`. Bổ sung method `update_status` để cập nhật trạng thái cài đặt plugin độc lập.
- **[core-engine/backend/tests/adapters/repositories/test_plugin_repo.py]** Thêm bộ Unit Test cho `SQLAlchemyPluginRepository`.

### Fixed
- **[core-engine/backend]** Thêm PostgreSQL Row-Level Security (RLS) Middleware và `current_tenant_id` ContextVar. Bổ sung RLS Policies cho các bảng multi-tenant trong `init.sql`.
- **[deploy/setup.sh]** Thêm script triển khai tự động (1-click deploy), kiểm tra prerequisites, tự động tạo secret, nhắc cấu hình hosts file, khởi chạy docker compose và kiểm tra healthchecks.
- **[core-engine/backend/app/adapters/external/n8n_adapter.py]** Sửa lỗi SSRF Risk và thiếu Auth Header trong `trigger_webhook`.
- **[deploy/keycloak/realm-import.json]** Khởi tạo Keycloak Realm Export file (`realm-import.json`) cho hệ thống `proteus` để import tự động khi khởi động (Zero-touch configuration).
- **[deploy/docker-compose.yml]** Cấu hình tự động import Realm cho Keycloak (mount volume và flag `--import-realm`).
- **[core-engine/backend/app/adapters/repositories/plugin_repo.py]** Hoàn thiện implementation cho `SQLAlchemyPluginRepository`. Bổ sung method `update_status` để cập nhật trạng thái cài đặt plugin độc lập.
- **[core-engine/backend/app/adapters/external/n8n_adapter.py]** Bổ sung exponential backoff cho cơ chế retry và tái sử dụng `AsyncClient`.
- **[core-engine/backend/app/adapters/external/n8n_adapter.py]** Xử lý giá trị `"id"` bằng `0` (integer 0 edge case) trong `import_workflow`.
- **[.github/workflows/frontend-ci.yml]** Nâng cấp Node.js từ 20 → 22 (LTS) trong tất cả `setup-node` steps để loại bỏ deprecation warning trên GitHub Actions runners (Node 20 bị deprecated từ 2025-09-19, bị force run trên Node 24).
- **[.github/workflows/backend-ci.yml]** Đổi `name: backend-ci ✅` → `name: backend-ci` để khớp chính xác với required status check context trong Branch Protection Rules của `main` branch.
- **[.github/workflows/frontend-ci.yml]** Đổi `name: frontend-ci ✅` → `name: frontend-ci` để khớp với Branch Protection required check `frontend-ci`.
- **[.github/workflows/pr-check.yml]** Đổi `name: Validate PR Title, Body & Issue Link` → `name: validate-pr` để khớp với Branch Protection required check `validate-pr`. Khi `name:` không khớp, GitHub báo trạng thái "Expected — Waiting for status to be reported" dù check đã pass.


### Added
- **[core-engine/frontend/src/components/AIChatWidget.tsx]** Triển khai AI Chat Widget (floating) với 4 trạng thái (collapsed, expanded, thinking, awaiting_approval). Hỗ trợ hiển thị DSL preview và chuyển tiếp phê duyệt qua Mattermost (#33).
- **[core-engine/frontend/src/hooks/useAICommand.ts]** Hook quản lý state cho AI Chat Widget và xử lý BFF API request.
- **[core-engine/frontend/src/app/api/ai/command]** Thêm BFF API Route xử lý logic cho AI Command (forward request đến FastAPI kèm JWT từ HttpOnly cookie).
- **[core-engine/frontend/src/app/marketplace]** Xây dựng trang Plugin Marketplace dành riêng cho `tenant_admin` (#32). Hỗ trợ xem, cài đặt, và gỡ cài đặt Plugin. Cung cấp Install Preview Modal hiển thị tài nguyên sẽ tạo (Bảng DB, Workflows, Roles) và Progress bar cập nhật theo thời gian thực (polling cơ chế provisioning n8n). Bổ sung Uninstall Confirm Modal bắt buộc gõ tên để xác nhận.
- **[core-engine/frontend/src/app/launchpad]** Hoàn thiện giao diện Launchpad (Màn hình chính) với App Icon Grid, hỗ trợ Quick links (Mattermost, Outline, n8n), mở Iframe Overlay toàn màn hình dạng Glassmorphism cho Metabase & n8n, hiển thị Skeleton loading và Empty state khi chưa có plugin (#31).
- **[core-engine/frontend/src/app/api/embed/metabase]** Thêm API Route (BFF) để proxy và giả lập (mock) việc lấy URL nhúng Metabase an toàn có chứa `tenant_id` từ session (#35).
- **[core-engine/frontend/src/components]** Phát triển khung giao diện tổng (App Shell) tích hợp Dynamic UI Role-based. Navigation hiển thị linh hoạt theo quyền (ẩn/hiện Marketplace cho `tenant_admin`). Hỗ trợ Responsive Sidebar trên mobile (#30).
- **[core-engine/frontend/src/app/login]** Xây dựng trang Đăng nhập (`/login`) với phong cách Premium Glassmorphism, tích hợp Keycloak SSO qua `next-auth`, xử lý lỗi hết hạn phiên và phục hồi dữ liệu từ `sessionStorage` (#29).
- **[core-engine/frontend]** Implement Theme Store (`themeStore.ts` với `zustand/persist`) và Notification Store (`notificationStore.ts`) tích hợp với `usePlugins` (#28).
- **[core-engine/frontend/src/components/ui]** Tạo UI Component Library (Button, PluginCard, AppIcon, Toast, Modal, Skeleton, ProgressBar) chuẩn Design System §5.4 và §5.6 (#27).
- **[core-engine/frontend]** Implement Design System từ docs/ui_ux_design.md §5.1-5.3 (CSS Variables, Typography, Spacing, Glassmorphism) (#26).
- **[core-engine/backend/app/adapters/external/metabase_adapter.py]** Thêm Metabase BI Adapter để tạo dashboard và quản lý signed embed URL với TTL 60s.
- **[core-engine/backend/app/adapters/external/appsmith_adapter.py]** Thêm Appsmith UI Adapter để xử lý import/delete UI Apps và kiểm tra PATH_CONFLICT.
- **[core-engine/backend/app/adapters/external/redis_event_bus.py]** Thêm Redis Event Bus Publisher xử lý publish lifecycle events qua Redis Pub/Sub, tự động inject wrapper cho event envelope.
- **[core-engine/backend/app/core/use_cases/manifest_validator.py]** Thêm Manifest Validator (Use Case) để parse và validate `manifest.yaml` theo đặc tả v1.1.0, trả về ManifestEntity.
- **[.github/workflows/pr-check.yml]** Validate PR title (Conventional Commits format), body (không rỗng), và issue link (`closes #N`/`fixes #N`) — tự động comment hướng dẫn lên PR khi fail.
- **[.github/workflows/plugin-manifest-lint.yml]** YAML syntax check (yamllint) + Python schema validator cho `manifest.yaml` trong `plugins/` — kiểm tra required fields, semver, table prefix, ui_apps paths theo `plugin-manifest-spec.md v1.1.0`.
- **[.github/workflows/dependency-review.yml]** GitHub native CVE scan trên PR thay đổi dependency files (`requirements.txt`, `package.json`). Fail nếu có CVE severity HIGH/CRITICAL.
- **[.github/workflows/label-pr.yml]** Auto-label PR theo paths thay đổi. Config trong `.github/labeler.yml` khớp với label taxonomy của 51 issues (backend, frontend, devops, plugin, ai, security, M1–M6).
- **[.github/labeler.yml]** Config mapping paths → labels cho `actions/labeler@v5`.
- **[.github/workflows/backend-ci.yml]** GitHub Actions CI cho FastAPI backend: Lint (Black + flake8 + isort), Security scan (Bandit), Alembic migration verification (PostgreSQL service container), Pytest coverage ≥70%. Trigger trên `push`/`PR` vào `main`/`develop` khi có thay đổi trong `core-engine/backend/`.
- **[.github/workflows/frontend-ci.yml]** GitHub Actions CI cho Next.js frontend: ESLint (`--max-warnings=50`), TypeScript type check (`tsc --noEmit`), Vitest unit tests, Next.js production build + bundle size report. Trigger khi có thay đổi trong `core-engine/frontend/`.
- **[.github/workflows/docker-ci-cd.yml]** Build & Push Docker images lên GHCR (`ghcr.io/cuongkenn/ictu_proteus-os/backend|frontend`). Sử dụng `dorny/paths-filter` để chỉ build service có thay đổi. Hỗ trợ Deploy Webhook trigger sau khi build thành công trên `main`.

- **[.github/workflows/cleanup-stale-branches.yml]** Tự động xóa branch không hoạt động >90 ngày, chạy lúc 2:00 AM (UTC+7) mỗi Chủ nhật. Bảo vệ `main`, `develop`, `release/*`, `hotfix/*`. Mặc định `dry_run=true` để an toàn.
- **[.github/workflows/protect-issues.yml]** Tự động reopen issue bị đóng thủ công không qua PR merge. Issue chỉ được đóng khi PR merge vào `main` có từ khóa `closes #N`/`fixes #N`/`resolves #N`.
- **[deploy/docker-compose.yml]** Full stack Docker Compose với 10 services: Traefik, PostgreSQL 16, Redis 7, Keycloak 25, Qdrant, n8n, Metabase, Appsmith, Outline, core-engine (backend + frontend). Mọi service đều có healthcheck và restart policy.

- **[deploy/.env.example]** Template biến môi trường đầy đủ với comment và hướng dẫn cho từng section (domain, PostgreSQL, Redis, Keycloak, n8n, Metabase, Outline, LLM Provider).
- **[deploy/traefik/traefik.yml]** Traefik v3 static config: Docker provider, JSON access log (Authorization header bị redact), placeholder cho Let's Encrypt.
- **[deploy/postgres/init.sql]** Core Schema SQL khởi tạo 6 bảng: `tenants`, `users`, `plugins`, `tenant_plugins`, `roles`, `audit_logs`, `ai_commands`. Đầy đủ ENUMs, indexes, auto-update triggers, COMMENT cho mọi bảng/cột. Tạo schema riêng cho Keycloak, n8n, Metabase, Outline.
- **[core-engine/Dockerfile]** Multi-stage Dockerfile: stage `backend` (Python 3.12-slim + uvicorn), stage `frontend-builder` (Node 20 build Next.js), stage `frontend` (standalone production image).
- **[core-engine/backend/]** FastAPI Hexagonal Architecture đầy đủ: `main.py` (entry point + CORS), `infrastructure/` (config, database async engine, structlog logging), `core/domain/` (entities, exceptions — pure Python), `adapters/repositories/` (AbstractPluginRepository + SQLAlchemy implementation), `adapters/external/keycloak_adapter.py` (JWT verify + Role CRUD), `entrypoints/dependencies.py` (JWT → TenantContext injection), `entrypoints/routers/` (health, plugins, ai), `entrypoints/schemas/` (plugin, ai_command Pydantic models).
- **[core-engine/frontend/]** Next.js 14 App Router + BFF pattern: `package.json` (Next.js, NextAuth, Zustand, Axios, Tailwind), `tailwind.config.ts` (đầy đủ Design Tokens từ `docs/ui_ux_design.md`), `src/styles/globals.css` (CSS Variables, glass-card, gradient-text utilities), `src/lib/authOptions.ts` (NextAuth + Keycloak OIDC, JWT session), `src/app/api/auth/[...nextauth]/` (NextAuth handler), `src/app/api/proxy/[...path]/` (BFF Proxy injecting Bearer token), `src/store/authStore.ts` (Zustand auth state), `src/lib/api.ts` (Axios → BFF, 401 interceptor), `src/types/index.ts` (domain types + NextAuth extensions), `src/app/layout.tsx` (root layout dark mode), `src/app/launchpad/page.tsx` (skeleton), `src/hooks/usePlugins.ts` (ViewModel hook).
- **[plugins/hr-module/manifest.yaml]** HR Module manifest đầy đủ theo `plugin-manifest-spec.md` v1.1.0: 10 phần, 3 roles (hr_manager/hr_viewer/leave_approver), 3 workflows (webhook + cron), 3 event_publications, default_config.
- **[plugins/hr-module/db/seed_data.sql]** HR Schema: 3 bảng (`hr_employees`, `hr_leave_requests`, `hr_attendance_logs`) với ENUMs, indexes, auto-update triggers. Không có `tenant_id` (Plugin Manager inject).
- **[.github/ISSUE_TEMPLATE/feature.yml]** GitHub Feature Request template với component dropdown và checklist.
- **[.github/ISSUE_TEMPLATE/bug.yml]** GitHub Bug Report template với severity dropdown, environment info.
- **[.github/pull_request_template.md]** PR Checklist template: Backend/Frontend/AI/HITL/Docs sections, hướng dẫn test.



### Added
- **[docs/plugin-manifest-spec.md §3.2]** Thêm trường `database.default_config` (jsonb): khai báo cấu hình mặc định của Plugin mà `tenant_admin` có thể override qua `TENANT_PLUGIN.config_override`.
- **[docs/plugin-manifest-spec.md §3.3]** Thêm trường `workflows[].cron_expression`: bắt buộc khi `trigger: cron`. Có bảng mô tả 5 trường cron + ví dụ 3 schedule phổ biến. Bảng so sánh 3 loại trigger (webhook/cron/manual).
- **[docs/plugin-manifest-spec.md §5]** Thêm **Uninstall Lifecycle** hoàn chỉnh: flow diagram 6 bước rollback ngược thứ tự cài đặt, cảnh báo DROP TABLE, xử lý event_subscriptions của Plugin phụ thuộc, yêu cầu Admin gõ xác nhận tên plugin.
- **[docs/plugin-manifest-spec.md §3.5/3.6]** Thêm mô tả chi tiết cho PHẦN 5 (Dashboards), PHẦN 6 (UI Apps path rules), PHẦN 7 (Roles & Permissions format).
- **[docs/plugin-manifest-spec.md §3.7]** Thêm mô tả PHẦN 8 & 9: sơ đồ Event wrapper đầy đủ, phân tách rõ phần Plugin Manager inject vs phần Plugin khai báo trong `payload_schema`.
- **[docs/plugin-manifest-spec.md §2]** Thêm `dependencies[].min_version`: version tối thiểu của plugin phụ thuộc.
- **[docs/clarification.md §6.8]** Thêm `dependencies` block vào ví dụ manifest của finance-module, cập nhật `handler_workflow` thành đường dẫn tương đối chuẩn với prefix `workflows/`.

### Changed
- **[docs/plugin-manifest-spec.md §2/3.2]** Tách rõ logic `database.tables` vs `database.seed_file`: `tables[]` là **độc lập và bắt buộc** nếu Plugin tạo bảng (không phụ thuộc vào seed_file). `seed_file` là tùy chọn bổ sung. Đã swap lại thứ tự trong YAML schema (tables trước, seed_file sau) để phản ánh mức độ ưu tiên đúng.
- **[docs/plugin-manifest-spec.md §3.6]** Cập nhật quy tắc `ui_apps[].path`: bắt buộc prefix `/apps/`, danh sách path hệ thống bị cấm, xử lý conflict `PATH_CONFLICT`, format validation.
- **[docs/plugin-manifest-spec.md §3.6]** Giải thích `roles[].permissions[]` format `{plugin}:{resource}:{action}`: lưu vào PostgreSQL bảng `ROLE` (jsonb), Keycloak chỉ lưu tên Role. Thêm bảng ví dụ permission strings.
- **[docs/plugin-manifest-spec.md §9]** Thêm `approved_by_user_id` vào `payload_schema` của `hr.leave_request.approved` (thiếu so với ERD).
- **[docs/plugin-manifest-spec.md]** Nâng phiên bản spec: `1.0.0` → `1.1.0`. Thêm mục §7 Lịch sử Phiên bản.
- **[docs/clarification.md §6.8]** Đồng bộ `handler_workflow` format: `finance_sync_workflow.json` → `"workflows/finance_sync_workflow.json"` (đường dẫn tương đối từ thư mục gốc plugin).
- **[core-engine/backend/app/core/use_cases/ai_command.py]** Sửa lỗi vi phạm Hexagonal Architecture, dùng Repository thay cho việc gọi trực tiếp cơ sở dữ liệu.
- **[core-engine/backend/app/core/use_cases/ai_timeout_worker.py]** Sửa lỗi vi phạm Hexagonal Architecture, dùng Repository thay cho việc gọi trực tiếp cơ sở dữ liệu.
- **[core-engine/backend/app/core/use_cases/dsl_dry_run.py]** Sửa lỗi vi phạm Hexagonal Architecture, dùng Repository thay cho việc gọi trực tiếp cơ sở dữ liệu.
- **[core-engine/backend/app/core/use_cases/proactive_monitor.py]** Sửa lỗi vi phạm Hexagonal Architecture, dùng Repository thay cho việc gọi trực tiếp cơ sở dữ liệu.
- **[core-engine/backend/app/core/use_cases/dsl_validator.py]** Sửa lỗi vi phạm Hexagonal Architecture, dùng AbstractPluginRepository thay cho AsyncSession trực tiếp.

### Fixed
- **[docs/plugin-manifest-spec.md §9]** Fix: `event_publications.payload_schema` chỉ khai báo phần bên trong `payload{}`. Thêm ghi chú rõ ràng: wrapper chuẩn (`event_id`, `event_type`, `tenant_id`, `plugin_source`, `created_at`) do Plugin Manager tự inject — Plugin không cần khai báo.
- **[docs/plugin-manifest-spec.md §3.3]** Fix logic `seed_file` vs `tables` bị mơ hồ: làm rõ đây là hai trường độc lập với mục đích khác nhau.

---



### Added
- **[docs/plugin-manifest-spec.md]** Tạo mới tài liệu đặc tả đầy đủ schema `manifest.yaml` cho Plugin system: 10 phần (metadata, compatibility, database, workflows, dashboards, ui_apps, roles, event_subscriptions, event_publications, dependencies), ví dụ `hr-module` hoàn chỉnh, vòng đời cài đặt (Compensating Transaction), chiến lược migration với naming convention.
- **[CONTRIBUTING.md]** Mở rộng từ 35 dòng lên đầy đủ 7 mục: bảng tài liệu cần đọc trước khi code, quy tắc Conventional Commits (bảng type + ví dụ), Coding Standards chi tiết Frontend/Backend (linter, formatter, architecture rules, bản quyền SPDX), Testing requirements (pytest + Jest), Issue/Feature Request template.
- **[docs/BRD.md FR5]** Thêm cross-reference đến `plugin-manifest-spec.md` ngay sau mô tả `manifest.yaml`.
- **[README.md]** Thêm link đến `plugin-manifest-spec.md` trong mục Documentation.

### Changed
- **[CHANGELOG.md]** Tái cấu trúc: gộp 2 section `## [Unreleased]` thành 1, xóa `### Changed (tiếp theo)` không chuẩn, sắp xếp lại theo đúng format Keep a Changelog. Thêm link [Keep a Changelog](https://keepachangelog.com/) vào header.
- **[docs/BRD.md FR1]** Chuẩn hóa Wiki/CMS: "Outline/BookStack" → "Outline" (nhất quán với `architecture.md`, `deployment.md`).
- **[docs/deployment.md §3]** Cập nhật lệnh `docker-compose ps` → `docker compose ps` (Docker Compose v2 chuẩn), giữ ghi chú tương thích v1.

### Fixed
- **[README.md]** Xóa thẻ `</div>` thừa và badge Docker bị duplicate trong phần header badges.
- **[docs/clarification.md §8.1]** Fix typo "nhình ngày lưu" → "được lưu trong HttpOnly Cookie và" (câu không rõ nghĩa).

---



### Added
- **[docs/dsl-spec.md]** Đặc tả chuẩn DX-DSL cho AI Orchestrator: cấu trúc JSON, action whitelist với cột Required Role, effect levels, validation rules, `approval_deadline` field.
- **[docs/clarification.md §6]** Giải thích cơ chế giao tiếp liên Plugin: Loose Coupling qua Redis Pub/Sub, Event Schema chuẩn (bắt buộc `tenant_id`), Event Naming Convention, ví dụ end-to-end HR→Finance, khai báo `event_subscriptions` trong `manifest.yaml`.
- **[docs/clarification.md §7]** Phân quyền cài đặt Plugin: phân cấp 3 tầng Role (Platform/Tenant/Plugin), ma trận quyền, luồng cài đặt 2 bước, xử lý khi AI được yêu cầu cài Plugin.
- **[docs/clarification.md §8]** Thêm mục mới "Quản lý Token & Phiên làm việc": bảng TTL Token (Access/Refresh/Session), luồng Silent Refresh chi tiết, Refresh Token Rotation security, xử lý khi Refresh Token hết hạn (buộc re-login), bảng edge case (5 tình huống).
- **[docs/clarification.md §9]** Tổng hợp toàn bộ AI capabilities: 3 chế độ (RAG Assistant/Proactive Monitor/Executive Agent), capability matrix theo plugin, danh sách hard limits, ranh giới AI vs. con người.
- **[docs/deployment.md §7]** Yêu cầu hạ tầng cho AI Services: Qdrant, Redis, n8n, LangChain; cấu hình LLM Provider (`.env`); lịch Cron cho Proactive Monitor; cảnh báo chi phí token.
- **[docs/architecture.md ADR-002]** Quyết định kiến trúc: không dùng Graph RAG ở v1.0, thay bằng Qdrant Hybrid Search (Dense Vector + BM25). Phân tích chi phí/lợi ích và điều kiện xem xét lại ở v2.0.
- **[docs/erd.md §2.4]** Thêm bảng `AI_COMMAND` vào ERD: lưu lịch sử DX-DSL Command với đầy đủ approval workflow (`approved_by`, `second_approver`, `mattermost_message_id`, `approval_deadline`, `execution_result`). Giải thích lý do tách riêng khỏi `AUDIT_LOG` để query hiệu quả. Bảng trạng thái đầy đủ 6 status.
- **[docs/ui_ux_design.md §5]** Thêm Design System hoàn chỉnh: Color Palette (14 tokens Dark Mode + 4 tokens Light Mode với HSL/Hex), Typography System (font family + 7-level type scale), Spacing & Grid System (8 tokens + layout specs), Component Inventory (Button variants+states, Plugin Card wireframe+6 states, App Icon spec, Toast 4 types, AI Widget states, Loading/Empty states), Navigation Flow Diagram (Mermaid), Animation & Motion table (8 interactions).
- **[.agents/AGENTS.md §6]** Rule mới: Quy tắc cập nhật CHANGELOG.md — bảng trigger cases, định dạng Keep a Changelog, quy tắc viết nội dung.
- **[landing-page/index.html]** Viết lại toàn bộ GitHub Pages landing page với thiết kế premium Glassmorphism Dark Mode: thêm 10 sections mới (Problem, H-P-D-I, Agentic AI, Marketplace, Launchpad Preview, Tech Stack, Documentation Grid, Roadmap, Quick Start, CTA), Navbar responsive với hamburger mobile menu, Stats bar với counter animation, Footer 4 cột đầy đủ links.
- **[landing-page/styles.css]** Viết lại toàn bộ CSS bằng Vanilla CSS (loại bỏ Tailwind CDN dependency): Design Tokens CSS Variables theo Design System chuẩn, Background Orbs animation, Grid overlay pattern, tất cả component styles (Glass Card, HPDI Cards, AI Mode Cards, Tech Grid, Docs Grid, Roadmap Timeline, CTA Box, Footer), Responsive breakpoints đầy đủ (1024px, 768px, 480px), Intersection Observer reveal animations, Counter animation.

### Changed
- **[docs/architecture.md §2.3]** Mở rộng AI Orchestrator section: bảng 3 chế độ AI, execution flow diagram, Hard Limits note, cross-reference đến `clarification.md §9`. Thêm bảng phân công rõ ràng "n8n vs. LangChain (FastAPI)" cho cả 3 chế độ AI: RAG Assistant (LangChain toàn bộ, n8n không tham gia), Proactive Monitor (n8n toàn bộ, LangChain không tham gia), Executive Agent (LangChain nửa trước reasoning + DX-DSL, n8n nửa sau execution). Giải thích lý do không thay LangChain bằng n8n AI Nodes cho production.
- **[docs/architecture.md §3]** Mở rộng RBAC: liệt kê rõ 3 tầng (Platform/Tenant/Plugin), link đến `clarification.md §7`.
- **[docs/BRD.md FR4]** Chuẩn hóa Qdrant (bỏ Milvus); thêm giới hạn FR4.2 (Monitor chỉ báo cáo); thêm cross-ref đến `clarification.md §9`.
- **[docs/BRD.md FR5]** Làm rõ "Quản trị viên" = `tenant_admin`; chỉ `tenant_admin` và `superadmin` có quyền cài Plugin.
- **[docs/BRD.md FR1]** Chuẩn hóa Wiki/CMS: "Outline/BookStack" → "Outline" (nhất quán với toàn bộ tài liệu).
- **[docs/erd.md §2.2]** Mở rộng mô tả bảng ROLE: bảng mini permission matrix cho 3 loại role.
- **[docs/erd.md §2.4]** Mở rộng `AUDIT_LOG.actor_type`: giải thích 3 giá trị (HUMAN/AI_AGENT/SYSTEM), note về trace `command_id`.
- **[docs/erd.md §4.3]** Sửa duplicate `CREATE POLICY` (SQL error): gộp thành 1 policy `FOR ALL` đúng, thêm `DROP POLICY IF EXISTS` hint, thêm `TO app_user`.
- **[docs/dsl-spec.md §1]** Thêm cross-reference đến `clarification.md §9` ở đầu Overview.
- **[docs/dsl-spec.md §5]** Đổi JSON code block sang `jsonc` + disclaimer; thêm trường `approval_deadline` vào schema và field table.
- **[docs/dsl-spec.md §3.1]** Thêm cột `Required Role` vào bảng nhóm `finance` (thiếu so với bảng `core` và `hr`): `finance_viewer`, `finance_approver`, `tenant_admin` theo từng action.
- **[docs/api-swagger.yaml]** Thêm endpoint `POST /webhooks/keycloak/events`; thêm Required Role vào description của `/plugins/install`, `/plugins/{id}`, `/health/detailed`; fix security của `/health/detailed` (từ anonymous → auth required). Thống nhất server URL Development: `http://api.proteus.local/api/v1` → `http://localhost:8000/api/v1`.
- **[docs/clarification.md §2.3]** Sửa mâu thuẫn Metabase Signed Embedding: forward đến §4 thay vì mô tả như tính năng hoạt động.
- **[docs/clarification.md §9.4]** Thêm link ngược tham chiếu đến `docs/dsl-spec.md` tại mục CAUTION về `DSL_INVALID_ACTION`.
- **[docs/deployment.md §2.1]** Bổ sung routing `/files/`, `/wiki/`, `/workflow/`, `/analytics/`, `/monitoring/` cho Nextcloud, Outline, n8n, Metabase, Grafana.
- **[docs/deployment.md §2.2]** Bổ sung Nextcloud, Outline, Grafana, Qdrant, Redis, n8n, Metabase vào Mermaid network diagram.
- **[docs/deployment.md §3]** Cập nhật lệnh `docker-compose ps` → `docker compose ps` (Docker Compose v2), giữ lại ghi chú tương thích v1.

### Fixed
- **[docs/architecture.md]** Mermaid diagram EventBus label: "Redis / RabbitMQ" → "Redis Pub/Sub" (nhất quán với ADR-001).
- **[docs/BRD.md]** Event Bus: "Redis Pub/Sub hoặc RabbitMQ" → "Redis Pub/Sub" (nhất quán với ADR-001).
- **[docs/BRD.md]** Fix link broken `./docs/clarification.md §9` → `./clarification.md §9` (BRD nằm trong thư mục `docs/` nên đường dẫn trỏ sai).
- **[docs/BRD.md §5]** Cập nhật cây thư mục `docs/`: thêm `BRD.md`, `dsl-spec.md`, `deployment.md` còn thiếu; cập nhật mô tả `architecture.md` và `api-swagger.yaml`.
- **[docs/dsl-spec.md §6]** Fix typo "bửi" → "bởi" trong mô tả validation rule Permission check.
- **[docs/clarification.md §8]** Fix typo "nhình ngày lưu" → "được lưu trong" tại mô tả bảo mật Refresh Token.
- **[README.md]** Xóa thẻ `</div>` thừa (không có thẻ mở tương ứng) ở phần badges header.

---

*Lưu ý: Dự án đang trong giai đoạn phát triển ban đầu (Proof of Concept). Phiên bản đầu tiên chính thức sẽ được đánh số `v1.0.0` khi hệ thống được triển khai hoàn chỉnh.*
