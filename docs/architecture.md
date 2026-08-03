# Sơ đồ Kiến trúc Tổng thể & Thiết kế Hệ thống (SAD)

Tài liệu này mô tả chi tiết Kiến trúc Tổng thể của toàn bộ hệ sinh thái **Proteus OS**, cũng như thiết kế kỹ thuật chuyên sâu của phân hệ lõi (Frontend & Backend).

---

## 1. Kiến trúc Tổng thể (Toàn hệ thống H-P-D-I)

Proteus OS sử dụng kiến trúc **Micro-Kernel (Nhân vi lõi) kết hợp với các Dịch vụ Độc lập (Microservices/Open-source tools)**. 

Thay vì tự xây dựng mọi thứ, phần lõi (Core Engine) đóng vai trò là "Bộ não điều phối" (Orchestrator) và "Cổng giao tiếp" (API Gateway), kết nối các công cụ nguồn mở tốt nhất thế giới lại với nhau.

```mermaid
graph TD
    subgraph Frontend [Frontend: Launchpad & App Store]
        UI[Next.js App Shell]
    end

    subgraph CoreBackend [Backend: Core Engine]
        API[FastAPI Gateway]
        Orch[AI Orchestrator]
        PluginMgr[Plugin Manager]
    end

    subgraph OpenSourceEcosystem [Các Không gian H-P-D-I]
        Keycloak[(Keycloak - Identity)]
        Mattermost[Mattermost - Chat]
        n8n[n8n - Workflow]
        Metabase[Metabase - BI]
        PG[(PostgreSQL)]
        Qdrant[(Qdrant - Vector DB)]
        Appsmith[Appsmith - Lowcode UI]
    end

    User((Người dùng)) --> UI
    UI --> Keycloak : 1. Đăng nhập SSO
    UI --> API : 2. Giao tiếp API (JWT)
    API --> Keycloak : 3. Xác thực Token
    
    API --> PluginMgr
    PluginMgr --> PG : Khởi tạo Bảng dữ liệu
    PluginMgr --> n8n : Nạp luồng Quy trình
    PluginMgr --> Metabase : Tạo Dashboard
    
    API --> Orch
    Orch --> Qdrant : RAG (Truy xuất Tri thức)
    Orch --> n8n : Kích hoạt Hành động (Agent)
    Orch --> Mattermost : Gửi tin nhắn Phê duyệt

    Appsmith -.-> UI : Nhúng qua Iframe
    Metabase -.-> UI : Nhúng qua Iframe
```

---

## 2. Kiến trúc Lõi (Core Engine Architecture)

Phần lõi do đội ngũ tự phát triển (Innovation Layer) được chia làm 2 thành phần độc lập: Frontend và Backend.

### 2.1. Frontend Architecture (Next.js)
Frontend sử dụng Next.js (React) với kiến trúc **BFF (Backend-for-Frontend)** để tối ưu hóa bảo mật và tốc độ.

```mermaid
graph LR
    subgraph Browser [Client Browser]
        React[React Client Components]
        Zustand[State Management]
    end
    
    subgraph FrontendServer [Next.js Server]
        SSR[Server-Side Rendering]
        NextAPI[Next API Routes / Proxy]
    end
    
    subgraph BackendServer [FastAPI Server]
        FastAPI[Core REST API]
    end

    React <--> NextAPI : Gọi API
    React <--> SSR : Hydration (Tải giao diện nhanh)
    NextAPI <--> FastAPI : Giao tiếp nội mạng (An toàn)
```

**Đặc điểm kỹ thuật Frontend:**
- **App Shell Design:** Tạo ra một khung viền giao diện duy nhất. Các ứng dụng khác (Appsmith, Metabase, Mattermost) được nhúng vào vị trí nội dung (Main Content Area) để giữ lại thanh điều hướng (Navbar) của Proteus OS.
- **BFF Pattern:** Client (Trình duyệt) không bao giờ gọi trực tiếp xuống FastAPI. Mọi request đi qua Next.js API Routes. Tại đây, Next.js sẽ đính kèm Access Token (lưu an toàn bằng HttpOnly Cookies) vào Header trước khi gửi xuống FastAPI, giúp chống lại tấn công XSS.

### 2.2. Backend Architecture (FastAPI)
Backend sử dụng **FastAPI (Python)**, được thiết kế theo mô hình **Domain-Driven Design (DDD)** và **Clean Architecture**.

**Cấu trúc các lớp (Layers):**
1. **API Router Layer:** Nhận request, kiểm tra đầu vào (Pydantic validation).
2. **Middleware/Auth Layer:** Giao tiếp với Keycloak để xác minh JWT Token, trích xuất `tenant_id` và `roles`. Từ chối các request không có quyền (403 Forbidden).
3. **Service Layer (Nghiệp vụ cốt lõi):**
   - *Plugin Service:* Đọc file `manifest.yaml`, kết nối database tạo Schema, gọi API của n8n và Metabase để khởi tạo môi trường (Provisioning) khi người dùng bấm "Cài đặt".
   - *AI Orchestrator Service:* Nhận prompt ngôn ngữ tự nhiên từ người dùng, nhúng (embed) vào Qdrant để tìm ngữ cảnh (RAG), sinh ra cấu trúc lệnh JSON (ReAct pattern), và đẩy lệnh cho n8n thực thi.
4. **Data Access Layer:** Tương tác với PostgreSQL thông qua ORM (SQLAlchemy). Bắt buộc nhúng `tenant_id` vào mọi câu lệnh WHERE để đảm bảo Row-Level Security.

---

## 3. Kiến trúc Đa khách hàng (Multi-Tenancy) & Phân quyền

Để Proteus OS có thể thương mại hoá dưới dạng SaaS bán cho nhiều tổ chức (trường học/doanh nghiệp) dùng chung trên 1 hệ thống đám mây, kiến trúc bảo mật được thiết kế như sau:

- **Cô lập Tài khoản (Keycloak Realms):** Sử dụng tính năng **Realms** của Keycloak. Mỗi khách hàng (Trường A, Doanh nghiệp B) là một Realm độc lập. Người dùng của Trường A không bao giờ đăng nhập chéo được vào Trường B.
- **Phân quyền Động (RBAC):** Khi một Plugin được cài đặt, nó định nghĩa các Vai trò (Role) trong `manifest.yaml`. Người dùng được gán Role trong Keycloak. Token JWT mang theo Role này và sẽ được Frontend đọc để giấu bớt giao diện (Dynamic UI) và Backend đọc để chặn truy cập trái phép.
- **Cô lập Dữ liệu (PostgreSQL Schema):** 
  - Sử dụng kiến trúc **Schema-per-tenant** (Mỗi tổ chức là một Schema riêng trong cùng 1 Database), hoặc 
  - Dùng kiến trúc Shared-Schema kết hợp cột `tenant_id` trên mọi bảng, đi kèm với **Row-Level Security (RLS)** để cô lập dữ liệu tuyệt đối ở cấp độ cơ sở dữ liệu. Giám đốc trường A không thể truy vấn sang bảng điểm của trường B.
- **Cô lập Ứng dụng (App Store):** Trường A có thể mua và cài Plugin "Quản lý Canteen", hệ thống sẽ kích hoạt Plugin này vào Schema của Trường A. Trường B sẽ không nhìn thấy tính năng này nếu chưa mua.
