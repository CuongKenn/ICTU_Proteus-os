# Hướng dẫn AI Agent làm việc với Proteus OS

Chào AI Agent, khi bạn được giao nhiệm vụ viết code, phân tích hoặc gỡ lỗi trong dự án **Proteus OS**, vui lòng tuân thủ tuyệt đối các quy tắc (Rules) dưới đây. Dự án này được thiết kế theo chuẩn Enterprise với kiến trúc Multi-Tenancy và Micro-Kernel.

## 1. Kiến trúc Tổng quan (Must Read)
- **Monorepo**: Dự án chia làm 3 phần chính:
  - `core-engine/`: Phần lõi (Innovation Layer) tự code (Next.js & FastAPI).
  - `plugins/`: Chứa các phân hệ mở rộng (VD: `hr-module`). Mỗi Plugin phải có `manifest.yaml` đi kèm.
  - `deploy/`: Cấu hình Docker Compose và Traefik proxy.
- **Hệ sinh thái Open-Source**: Hệ thống tích hợp Keycloak (SSO), Mattermost (Chat), n8n (Workflow), Appsmith (Low-code UI), Metabase (BI) và PostgreSQL, Qdrant. **Tuyệt đối không tự code lại (reinvent the wheel)** những chức năng cốt lõi mà các công cụ này đã hỗ trợ.

## 2. Quy tắc cho Frontend (core-engine/frontend)
- **Framework**: Next.js (React) + TailwindCSS.
- **State Management**: **TUYỆT ĐỐI KHÔNG DÙNG MVVM**. Bắt buộc sử dụng Custom Hooks kết hợp với **Zustand** để tách biệt Business Logic ra khỏi UI.
- **UI/UX**: Áp dụng phong cách thiết kế **Glassmorphism**, ưu tiên Dark Mode (tông Deep Blue/Neon Purple). Các ứng dụng ngoài (Appsmith, Metabase) luôn được nhúng qua Iframe bên trong App Shell.
- **Bảo mật (BFF Pattern)**: Trình duyệt không bao giờ gọi trực tiếp xuống FastAPI Backend. Mọi Request phải gửi qua Next.js API Routes (BFF) để đính kèm Token (JWT) đã lưu trữ an toàn, chống XSS.

## 3. Quy tắc cho Backend (core-engine/backend)
- **Framework**: FastAPI (Python).
- **Architecture**: Sử dụng **Hexagonal Architecture (Ports and Adapters)**. Cấm gọi trực tiếp Database hay thư viện bên ngoài từ Controller/Router. Mọi giao tiếp phải thông qua Use Cases và Adapters.
- **Đa khách hàng & Database**: PostgreSQL (SQLAlchemy). Mọi bảng lưu trữ dữ liệu nghiệp vụ **BẮT BUỘC phải có cột `tenant_id`**. Logic truy xuất phải luôn lấy `tenant_id` từ JWT Token của Keycloak để đảm bảo phân tách dữ liệu an toàn (Row-Level Security).
- **API Docs**: Sử dụng chặt chẽ `Pydantic` Models cho mọi Input/Output để Swagger sinh tài liệu tự động.

## 4. Quy tắc cho AI Orchestrator & Tác tử (Agentic AI)
- Tác tử AI (Agent) của hệ thống có quyền gọi API để thay đổi dữ liệu.
- **Rule Sinh Tử (Human-in-the-loop)**: Trước khi AI gọi bất kỳ Webhook/API thực thi nào (Ví dụ: Duyệt đơn, Chuyển tiền, Xóa tài khoản), AI **BẮT BUỘC** phải gửi một Interactive Message qua Mattermost yêu cầu Ban Giám Đốc bấm nút **[Phê duyệt]**. Tuyệt đối không để AI tự động Bypass luồng phê duyệt của con người.

## 5. Trước khi Code
- Hãy luôn dùng công cụ đọc file để đọc kỹ các tài liệu `docs/BRD.md`, `docs/architecture.md` và `docs/erd.md` trước khi thêm tính năng mới.
- Cập nhật tài liệu `CHANGELOG.md` và `docs/api-swagger.yaml` nếu có thay đổi về Endpoint hoặc luồng dữ liệu lớn.
