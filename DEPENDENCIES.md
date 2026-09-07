# Quản lý Thư viện & Gói Đính kèm (Dependencies & Bundling Policy)

**Dự án:** Proteus OS  
**Quy chuẩn:** Đáp ứng 100% Tiêu chí 5 - Tiêu chí PoF cuộc thi Phần mềm nguồn mở tích hợp AI 2026.

---

## 1. Tuyên bố Cam kết Nguyên tắc Mã nguồn mở (Bundling Policy)

Proteus OS tuân thủ nghiêm ngặt các nguyên tắc quản lý gói và thư viện của hệ sinh thái nguồn mở thế giới:

1. **Cố gắng tối đa sử dụng các thư viện và dịch vụ sẵn có:**
   - Hệ thống áp dụng triệt để nguyên tắc **"Không phát minh lại chiếc bánh xe" (Do Not Reinvent the Wheel)**. Thay vì tự viết lại các chức năng phức tạp, dự án tích hợp các nền tảng mã nguồn mở trưởng thành:
     - Identity & Access Management: **Keycloak** (Apache 2.0).
     - Workflow Automation Engine: **n8n** (Fair-code / Sustainable).
     - Business Intelligence & Dashboard: **Metabase** (AGPLv3).
     - Low-code UI Engine: **Appsmith** (Appsmith CE - Apache 2.0).
     - Team Communication: **Mattermost** (AGPLv3 / Apache 2.0).
     - Knowledge Base & Documentation: **Outline Wiki** (BSL/Open-Source).
     - Database: **PostgreSQL 16** (PostgreSQL License) & **Redis 7** (BSD-3-Clause).
     - Vector Database: **Qdrant** (Apache 2.0).
2. **Nguyên tắc "Zero Bundling / No Modified Vendoring":**
   - **Tuyệt đối KHÔNG đính kèm (bundle) mã nguồn của các dự án khác vào repository của Proteus OS.**
   - **Tuyệt đối KHÔNG sử dụng các bản sửa đổi (patched/modified forks) không chính thống của các thư viện.**
   - Toàn bộ các gói thư viện được khai báo tường minh qua tệp định nghĩa phụ thuộc chính thống:
     - Python: `core-engine/backend/requirements.txt` (tải trực tiếp từ PyPI chuẩn).
     - Node.js: `core-engine/frontend/package.json` và `package-lock.json` (tải trực tiếp từ npm Registry chuẩn).
     - Dịch vụ nền tảng: Docker Images chính thức từ Docker Hub và Quay.io của các tổ chức gốc.

---

## 2. Danh mục Thư viện Phụ thuộc Chính (Core Dependencies)

### 2.1. Backend (`core-engine/backend/requirements.txt`)

| Thư viện | Phiên bản | Giấy phép | Mục đích sử dụng | Nguồn phân phối |
| :--- | :--- | :--- | :--- | :--- |
| **fastapi** | `0.112.0` | MIT | Web framework bất đồng bộ hiệu năng cao | PyPI (tiêu chuẩn) |
| **uvicorn** | `0.30.6` | BSD-3-Clause | ASGI web server | PyPI (tiêu chuẩn) |
| **pydantic** | `2.8.2` | MIT | Xác thực dữ liệu và Schema validation | PyPI (tiêu chuẩn) |
| **sqlalchemy** | `2.0.32` | MIT | Async ORM truy xuất PostgreSQL | PyPI (tiêu chuẩn) |
| **asyncpg** | `0.29.0` | Apache 2.0 | PostgreSQL async driver | PyPI (tiêu chuẩn) |
| **redis** | `5.0.8` | MIT | Redis client cho Event Bus & Streams | PyPI (tiêu chuẩn) |
| **z3-solver** | `4.13.0.0` | MIT | Microsoft Z3 Theorem Prover (Kiểm chứng tĩnh AI) | PyPI (tiêu chuẩn) |
| **qdrant-client** | `1.10.1` | Apache 2.0 | Client kết nối Vector DB Qdrant | PyPI (tiêu chuẩn) |
| **fastembed** | `0.2.7` | Apache 2.0 | Local embedding sinh vector nhanh không cần GPU | PyPI (tiêu chuẩn) |
| **langchain** | `0.2.14` | MIT | Framework điều phối AI Agentic | PyPI (tiêu chuẩn) |
| **alembic** | `1.13.2` | MIT | Quản lý Database Migrations | PyPI (tiêu chuẩn) |
| **python-jose** | `3.3.0` | MIT | Xác thực và giải mã JWT từ Keycloak SSO | PyPI (tiêu chuẩn) |
| **httpx** | `0.27.2` | BSD-3-Clause | HTTP client bất đồng bộ gọi external adapters | PyPI (tiêu chuẩn) |
| **structlog** | `24.4.0` | Apache 2.0 / MIT | Structured JSON logging cho Loki | PyPI (tiêu chuẩn) |

### 2.2. Frontend (`core-engine/frontend/package.json`)

| Gói thư viện | Phiên bản | Giấy phép | Mục đích sử dụng | Nguồn phân phối |
| :--- | :--- | :--- | :--- | :--- |
| **next** | `^14.2.5` | MIT | React Framework cho SSR, App Router & BFF | npmjs (tiêu chuẩn) |
| **react** | `^18.3.1` | MIT | Thư viện UI nền tảng | npmjs (tiêu chuẩn) |
| **zustand** | `^4.5.4` | MIT | Quản lý Global State tách biệt khỏi UI | npmjs (tiêu chuẩn) |
| **tailwindcss** | `^3.4.7` | MIT | Utility-first CSS framework | npmjs (tiêu chuẩn) |
| **next-auth** | `^4.24.7` | ISC | Tích hợp Keycloak OAuth2 / OIDC | npmjs (tiêu chuẩn) |
| **lucide-react** | `^0.427.0` | ISC | Bộ icon giao diện hiện đại | npmjs (tiêu chuẩn) |
| **axios** | `^1.7.3` | MIT | HTTP client cho BFF API route | npmjs (tiêu chuẩn) |
| **vitest** | `^4.1.10` | MIT | Unit testing framework | npmjs (tiêu chuẩn) |

---

## 3. Cách thức Cài đặt Thư viện Không dùng Bundling

Để cài đặt các phụ thuộc một cách an toàn và kiểm tra tính toàn vẹn:

```bash
# Kiểm tra và cài đặt Backend Dependencies:
cd core-engine/backend
pip install -r requirements.txt

# Kiểm tra và cài đặt Frontend Dependencies với checksum lockfile:
cd core-engine/frontend
npm ci
```
