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
- **Kiến trúc Custom Hooks & Zustand (Thay thế MVVM):** Thay vì áp dụng mô hình MVVM truyền thống (vốn đi ngược lại triết lý One-way Data Flow của React), Frontend sử dụng mô hình Component-Based kết hợp Custom Hooks.
  - *View:* Các Function Components chỉ làm nhiệm vụ hiển thị UI tĩnh.
  - *ViewModel (Custom Hooks):* Đóng gói toàn bộ Business Logic và State Management (sử dụng **Zustand**) vào các hooks như `useAppStore()`, `useAuth()`. Điều này giúp tách biệt hoàn toàn giao diện khỏi logic nghiệp vụ, dễ dàng viết Unit Test.

### 2.2. Backend Architecture (FastAPI)
Backend sử dụng **FastAPI (Python)**, được thiết kế theo mô hình **Hexagonal Architecture (Ports and Adapters)** kết hợp với **Domain-Driven Design (DDD)**. 

Bởi vì Core Engine đóng vai trò là một "Orchestrator" phải gọi rất nhiều công cụ bên ngoài (n8n, Metabase, Keycloak, Qdrant), kiến trúc Hexagonal giúp giữ cho lõi nghiệp vụ hoàn toàn độc lập với các thư viện và framework bên ngoài.

**Cấu trúc các lớp (Layers):**
1. **Primary Adapters (Inbound):** 
   - *API Routers:* Nhận REST request từ Frontend BFF, validate bằng Pydantic.
   - *Middleware/Auth Layer:* Xác minh JWT Token từ Keycloak, trích xuất `tenant_id` và `roles`.
2. **Core Domain (Nghiệp vụ cốt lõi):**
   - *Plugin Use Cases:* Xử lý logic cài đặt/gỡ bỏ plugin.
   - *AI Orchestrator Use Cases:* Phân tích ngữ nghĩa lệnh AI, lên kế hoạch thực thi (ReAct pattern).
3. **Secondary Ports (Outbound Interfaces):** Định nghĩa các Abstract Base Classes (Interface) mà Domain cần dùng (VD: `IWorkflowEngine`, `IIdentityServer`).
4. **Secondary Adapters (Outbound):** Triển khai thực tế các Ports.
   - `N8nAdapter`: Gọi API n8n để nạp luồng.
   - `MetabaseAdapter`: Gọi API Metabase để tạo Dashboard.
   - `QdrantAdapter`: Giao tiếp với Vector DB.
   - `PostgresAdapter`: Tương tác DB thông qua SQLAlchemy (có RLS).
*(Kiến trúc này giúp dự án dễ dàng thay thế công cụ, ví dụ đổi từ Qdrant sang Milvus chỉ bằng cách viết một Adapter mới).*

---

## 3. Kiến trúc Đa khách hàng (Multi-Tenancy) & Phân quyền

Để Proteus OS có thể thương mại hoá dưới dạng SaaS bán cho nhiều tổ chức (trường học/doanh nghiệp) dùng chung trên 1 hệ thống đám mây, kiến trúc bảo mật được thiết kế như sau:

- **Cô lập Tài khoản (Keycloak Realms):** Sử dụng tính năng **Realms** của Keycloak. Mỗi khách hàng (Trường A, Doanh nghiệp B) là một Realm độc lập. Người dùng của Trường A không bao giờ đăng nhập chéo được vào Trường B.
- **Phân quyền Động (RBAC):** Khi một Plugin được cài đặt, nó định nghĩa các Vai trò (Role) trong `manifest.yaml`. Người dùng được gán Role trong Keycloak. Token JWT mang theo Role này và sẽ được Frontend đọc để giấu bớt giao diện (Dynamic UI) và Backend đọc để chặn truy cập trái phép.
- **Cô lập Dữ liệu (PostgreSQL Schema):** 
  - Sử dụng kiến trúc **Schema-per-tenant** (Mỗi tổ chức là một Schema riêng trong cùng 1 Database), hoặc 
  - Dùng kiến trúc Shared-Schema kết hợp cột `tenant_id` trên mọi bảng, đi kèm với **Row-Level Security (RLS)** để cô lập dữ liệu tuyệt đối ở cấp độ cơ sở dữ liệu. Giám đốc trường A không thể truy vấn sang bảng điểm của trường B.
- **Cô lập Ứng dụng (App Store):** Trường A có thể mua và cài Plugin "Quản lý Canteen", hệ thống sẽ kích hoạt Plugin này vào Schema của Trường A. Trường B sẽ không nhìn thấy tính năng này nếu chưa mua.
