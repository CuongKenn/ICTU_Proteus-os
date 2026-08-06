# Hướng dẫn Đóng góp (Contributing Guide)

Chào mừng bạn đến với **Proteus OS**! Chúng tôi rất vui vì bạn quan tâm và muốn đóng góp cho dự án.

Để quá trình làm việc nhóm diễn ra trơn tru, vui lòng đọc kỹ các quy tắc dưới đây trước khi gửi Pull Request (PR).

---

## 1. Triết lý Thiết kế

Trước khi code, hãy chắc chắn bạn đã đọc qua toàn bộ hệ thống tài liệu trong thư mục `docs/`:

| Tài liệu | Đọc để làm gì |
|---|---|
| **[BRD.md](./docs/BRD.md)** | Nắm rõ tầm nhìn, phạm vi và tiêu chí nghiệm thu |
| **[architecture.md](./docs/architecture.md)** | Hiểu kiến trúc Micro-Kernel, Hexagonal Backend, BFF Frontend |
| **[erd.md](./docs/erd.md)** | Nắm rõ cấu trúc Database và cơ chế RLS |
| **[dsl-spec.md](./docs/dsl-spec.md)** | Nếu đụng đến AI Orchestrator |
| **[clarification.md](./docs/clarification.md)** | Làm rõ Multi-Tenancy, RBAC, Human-in-the-loop |

> [!IMPORTANT]
> **Quy tắc vàng:** Không tự code lại (reinvent the wheel) những chức năng mà Keycloak, n8n, Appsmith, Metabase đã hỗ trợ. Core Engine chỉ đóng vai trò Orchestrator và API Gateway.

---

## 2. Quy trình Đóng góp

1. **Fork repository** về tài khoản cá nhân của bạn.
2. **Clone** repo đã fork về máy.
3. Tạo một **branch mới** từ nhánh `main`. Tên branch phải tuân thủ quy tắc:
   - `feature/tên-tính-năng` — Thêm tính năng mới
   - `bugfix/mô-tả-lỗi` — Sửa bug
   - `docs/tên-tài-liệu` — Cập nhật tài liệu
   - `refactor/tên-module` — Tái cấu trúc code không đổi behavior
4. Commit code theo **Conventional Commits** (xem §3 bên dưới).
5. Push branch lên repo đã fork của bạn.
6. Tạo **Pull Request (PR)** vào nhánh `main` của repo gốc.
7. **Bắt buộc cập nhật `CHANGELOG.md`** nếu thay đổi của bạn thuộc loại cần ghi nhận (xem bảng trigger tại `AGENTS.md §6`).

---

## 3. Quy ước Commit (Conventional Commits)

Dự án sử dụng chuẩn [Conventional Commits](https://www.conventionalcommits.org/). Mọi commit phải theo định dạng:

```
<type>(<scope>): <subject>
```

| Type | Dùng khi |
|---|---|
| `feat` | Thêm tính năng mới |
| `fix` | Sửa bug |
| `docs` | Cập nhật tài liệu |
| `refactor` | Tái cấu trúc code (không đổi behavior) |
| `test` | Thêm/sửa test |
| `chore` | Cấu hình CI/CD, dependencies |
| `style` | Format code, không đổi logic |

**Ví dụ commit hợp lệ:**
```
feat(plugin-manager): add compensating transaction on install failure
fix(auth): handle expired refresh token edge case
docs(erd): add AI_COMMAND table schema
```

---

## 4. Tiêu chuẩn Mã nguồn (Coding Standards)

### 4.1. Frontend (Next.js / TypeScript)

- **Linter:** ESLint với config `next/core-web-vitals`. Chạy `npm run lint` trước khi commit.
- **Formatter:** Prettier. Config được lưu tại `.prettierrc`.
- **State Management:** Tuyệt đối **không dùng MVVM**. Dùng **Custom Hooks + Zustand** để tách Business Logic khỏi UI.
- **API Calls:** Không bao giờ gọi trực tiếp từ Browser xuống FastAPI. Mọi request phải đi qua **Next.js API Routes (BFF)**.
- **Bảo mật:** Không lưu JWT Token, credentials hay bất kỳ thông tin nhạy cảm nào vào Zustand hay localStorage.
- **Design System:** Tuân thủ nghiêm ngặt CSS Variables và component patterns định nghĩa tại `docs/ui_ux_design.md §5`.

### 4.2. Backend (FastAPI / Python)

- **Formatter:** `black` (line length 88). Chạy `black .` trước khi commit.
- **Import sorter:** `isort`. Chạy `isort .` trước khi commit.
- **Linter:** `flake8` hoặc `ruff`.
- **Architecture:** Tuân thủ **Hexagonal Architecture** — cấm gọi Database hay thư viện ngoài trực tiếp từ Router. Phải đi qua Use Cases → Adapters.
- **API Schema:** Mọi Endpoint phải có Pydantic Model cho cả Input và Output (để Swagger tự sinh tài liệu).
- **Multi-tenancy:** Mọi bảng dữ liệu nghiệp vụ **bắt buộc có cột `tenant_id`**. Logic query phải lấy `tenant_id` từ JWT Token.
- **Bản quyền:** Chèn header AGPL-3.0 vào đầu mọi file Python mới:

```python
# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
```

### 4.3. TypeScript / React Files

```typescript
// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
```

---

## 5. Kiểm thử (Testing)

- **Backend:** Viết Unit Test bằng `pytest`. Test coverage tối thiểu **70%** cho các Use Case trong Innovation Layer.
- **Frontend:** Viết component test bằng `Jest` + `React Testing Library` cho các hooks quan trọng (`useAuth`, `usePluginStore`).
- **Chạy test trước khi tạo PR:**

```bash
# Backend
cd core-engine/backend
pytest --cov=. --cov-report=term-missing

# Frontend
cd core-engine/frontend
npm run test
```

---

## 6. Báo cáo Lỗi (Issue Reporting)

Nếu phát hiện lỗi, hãy tạo Issue mới trên GitHub với template sau:

**Tiêu đề:** `[BUG] Mô tả ngắn gọn lỗi`

**Nội dung bắt buộc:**
- **Môi trường:** Docker version, OS, Browser
- **Các bước tái hiện lỗi (Steps to reproduce)**
- **Kết quả mong muốn (Expected behavior)**
- **Kết quả thực tế (Actual behavior)**
- **Screenshot/Log nếu có**

---

## 7. Đề xuất Tính năng (Feature Request)

Tạo Issue với tiêu đề `[FEATURE] Tên tính năng`. Mô tả:
- Tính năng giải quyết vấn đề gì?
- Đề xuất giải pháp kỹ thuật (nếu có).
- Có ảnh hưởng đến kiến trúc hoặc security không?

---

Cảm ơn bạn đã đóng góp cho **Proteus OS**! 🚀
