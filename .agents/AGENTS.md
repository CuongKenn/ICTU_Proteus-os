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
- **Quy định Bản quyền (Open-Source License)**: BẮT BUỘC chèn đoạn Text chứa thông tin Bản quyền (Copyright) và Giấy phép (GNU AGPLv3) lên dòng đầu tiên của TẤT CẢ các file mã nguồn (Python, TypeScript, React, v.v.). Điều này nhằm tuân thủ chặt chẽ tính pháp lý của dự án Open-Source. 
  *(Gợi ý định dạng SPDX ngắn gọn: `Copyright (c) 2026 CuongKenn & ICTU Team` và `SPDX-License-Identifier: AGPL-3.0-or-later` ở dạng comment đầu file).*

## 6. Quy tắc Cập nhật CHANGELOG.md (Bắt buộc)

**BẮT BUỘC** cập nhật `CHANGELOG.md` sau mỗi thay đổi đáng kể. Không được commit mà bỏ qua bước này.

### 6.1. Khi nào phải cập nhật?

| Loại thay đổi | Phải update CHANGELOG? |
|---|---|
| Thêm tính năng mới (Feature) | ✅ Bắt buộc |
| Thay đổi API Endpoint (thêm/xóa/sửa) | ✅ Bắt buộc |
| Thay đổi schema Database (bảng, cột, migration) | ✅ Bắt buộc |
| Thay đổi kiến trúc (ADR, luồng dữ liệu lớn) | ✅ Bắt buộc |
| Sửa bug quan trọng (ảnh hưởng đến dữ liệu hoặc bảo mật) | ✅ Bắt buộc |
| Cập nhật tài liệu docs/ (nội dung đáng kể) | ✅ Bắt buộc |
| Sửa typo nhỏ, format code, comment | ❌ Không cần |
| Refactor nội bộ không đổi behavior | ❌ Không cần |

### 6.2. Định dạng bắt buộc (Keep a Changelog)

Luôn thêm mục mới vào section `## [Unreleased]` ở **đầu file**, phân loại theo nhóm:

```markdown
## [Unreleased] - Sắp tới

### Added
- [module/file] Mô tả tính năng mới thêm vào.

### Changed
- [module/file] Mô tả thay đổi đối với tính năng đã có.

### Fixed
- [module/file] Mô tả bug đã được sửa.

### Removed
- [module/file] Mô tả tính năng/code đã bị xóa.

### Security
- [module/file] Mô tả vá lỗ hổng bảo mật.
```

### 6.3. Quy tắc viết nội dung

- **Luôn ghi tên file/module** trong ngoặc vuông ở đầu dòng: `[docs/api-swagger.yaml]`, `[core-engine/backend]`, `[plugins/hr-module]`.
- **Viết từ góc nhìn người dùng/developer**, không phải từ góc nhìn kỹ thuật nội bộ. VD: "Thêm endpoint `POST /plugins/install`" thay vì "Sửa hàm `_provision_plugin()`".
- **Không để trống** các mục không có thay đổi — xóa hẳn nhóm đó thay vì để `### Added\n(trống)`.
- Cập nhật đồng thời `docs/api-swagger.yaml` nếu có thay đổi về Endpoint hoặc Schema.

## 7. Nguyên tắc bổ sung (Logging & Data)
- **Logging Standards**: Tuyệt đối KHÔNG sử dụng `print()`. Bắt buộc sử dụng thư viện `logging` chuẩn của Python/Node.js để log thông tin hệ thống (đặc biệt khi xử lý các API calls, AI tasks và background jobs).
- **Soft Delete (Xóa mềm)**: Mọi dữ liệu nhạy cảm hoặc cốt lõi (Core Data như Users, Tenants, Plugins) bắt buộc phải triển khai cơ chế Soft Delete (thêm cột `deleted_at`). Không dùng lệnh `DELETE` cứng trực tiếp vào CSDL để tránh mất dữ liệu nghiệp vụ quan trọng.

## 8. Tiêu Chuẩn Viết Code (SOLID & Design Patterns)

Tất cả AI Agents và lập trình viên phải nghiêm ngặt tuân thủ khi viết mã cho hệ thống:

### Tuân thủ Nguyên tắc SOLID
- **S (Single Responsibility):** Một Class/Function chỉ đảm nhiệm một việc. Ở Frontend, tách logic state ra Custom Hook, Component chỉ để render UI.
- **O (Open/Closed):** Dễ mở rộng nhưng HẠN CHẾ sửa code cũ. Nếu thêm tính năng mới, hãy dùng giao diện (Interface/Adapter) hoặc tạo Plugin mới thay vì sửa đổi phần lõi (core-engine).
- **D (Dependency Inversion):** Module cấp cao không phụ thuộc cấp thấp, cả hai cùng phụ thuộc Interface/Abstraction. Tầng Use Case (Backend) chỉ giao tiếp với Repository/Outbound Adapters qua Interface.

### Các Design Patterns Khuyến nghị
- **Repository Pattern:** Bắt buộc dùng ở tầng Backend Data Layer để giao tiếp với CSDL (Hoàn toàn phù hợp với Hexagonal Architecture).
- **Strategy Pattern:** Sử dụng để chuyển đổi linh hoạt các chiến lược/thuật toán (Ví dụ: Lựa chọn giữa các nhà cung cấp LLM khác nhau, các cơ chế xác thực).
- **Factory Pattern:** Sử dụng để khởi tạo các Client giao tiếp với dịch vụ/hạ tầng bên ngoài (như S3, Redis, LLM Client).
