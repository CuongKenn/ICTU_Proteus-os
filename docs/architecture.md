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
        EventBus[[Redis Pub/Sub - Event Bus]]
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
    n8n <--> EventBus : Pub/Sub Giao tiếp chéo Plugin
    API --> EventBus : Bắn sự kiện

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
- **App Shell Design:** Tạo ra một khung viền giao diện duy nhất. Các ứng dụng khác (Appsmith, Metabase, Mattermost) được nhúng vào vị trí nội dung (Main Content Area) để giữ lại thanh điều hướng (Navbar) của Proteus OS. Để khắc phục lỗi SameSite Cookie và X-Frame-Options khi nhúng Iframe, hệ thống sử dụng **Single-Domain Path-Based Routing** qua Traefik (tất cả các app chạy chung một domain gốc, vd: `proteus.local/chat`, `proteus.local/apps`).
- **BFF Pattern & Token Storage:** Client (Trình duyệt) không bao giờ gọi trực tiếp xuống FastAPI. Mọi request đi qua Next.js API Routes (BFF). Sau khi Keycloak trả về Access Token, **Next.js Server** (không phải browser) lưu Token vào **HttpOnly, Secure, SameSite=Strict Cookie**. Token không bao giờ xuất hiện ở JavaScript client, giúp chống lại tấn công XSS. Khi cần gọi FastAPI, Next.js API Route đọc Token từ Cookie phía server và đính kèm vào `Authorization: Bearer` Header trước khi forward request.
- **Zustand — Chỉ dùng cho UI State:** Zustand chỉ lưu trữ các trạng thái UI không nhạy cảm như: trạng thái sidebar (mở/đóng), theme (dark/light), ngôn ngữ hiển thị. **Tuyệt đối không lưu JWT Token, user credentials, hay bất kỳ thông tin nhạy cảm nào vào Zustand.**
- **Kiến trúc Custom Hooks & Zustand (Thay thế MVVM):** Thay vì áp dụng mô hình MVVM truyền thống (vốn đi ngược lại triết lý One-way Data Flow của React), Frontend sử dụng mô hình Component-Based kết hợp Custom Hooks.
  - *ViewModel (Custom Hooks):* Đóng gói toàn bộ Business Logic và State Management (sử dụng **Zustand**) vào các hooks như `useAppStore()`, `useAuth()`. Điều này giúp tách biệt hoàn toàn giao diện khỏi logic nghiệp vụ, dễ dàng viết Unit Test.

### 2.1.1. Luồng Xác thực SSO & Nhúng Iframe (Sequence Diagram)
Việc truyền Token vào Iframe (Appsmith/Metabase) một cách bảo mật thường vấp phải giới hạn SameSite Cookie hoặc CORS. Để khắc phục, hệ thống định tuyến Iframe đi qua Traefik Proxy và tận dụng cơ chế **HttpOnly Cookie chia sẻ cùng domain**.

> [!WARNING]
> **Anti-pattern cần tránh:** Tuyệt đối **KHÔNG** truyền JWT Token vào URL query parameter (VD: `?token=xxx`). Token trong URL sẽ bị lộ trong: browser history, server access log, `Referer` header khi click link, và màn hình shoulder-surfing. Đây là vi phạm nghiêm trọng OWASP A02:2021.

```mermaid
sequenceDiagram
    participant User as Người dùng
    participant Browser as Browser (Client)
    participant NextJS as Next.js Server (BFF)
    participant Keycloak as Keycloak (SSO)
    participant Traefik as Traefik Proxy
    participant Appsmith as Appsmith (Iframe)

    User->>Browser: Truy cập ứng dụng (VD: proteus.local/apps/hr)
    Browser->>NextJS: GET /apps/hr (chưa có session)
    NextJS->>Keycloak: Redirect đăng nhập (OIDC Authorization Code Flow)
    User->>Keycloak: Nhập username/password
    Keycloak-->>NextJS: Callback với Authorization Code
    NextJS->>Keycloak: Đổi Code lấy Access Token + Refresh Token
    Note over NextJS,Keycloak: Bước này xảy ra phía SERVER, browser không thấy Token
    NextJS->>Browser: Set-Cookie: session=<encrypted_token>; HttpOnly; Secure; SameSite=Strict
    Browser->>NextJS: GET /proxy/appsmith (tự động kèm HttpOnly Cookie)
    NextJS->>NextJS: Đọc Token từ Cookie (phía server), gắn vào Authorization Header
    NextJS->>Traefik: Forward request kèm Bearer Token (nội mạng)
    Note over NextJS,Traefik: Single-Domain Path-Based Routing (cùng domain proteus.local)
    Traefik->>Appsmith: Chuyển tiếp Request nội mạng (Kèm Session/Auth)
    Appsmith-->>Browser: Render HTML (Đã đăng nhập thành công)
    Browser-->>User: Hiển thị giao diện liền mạch
```

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

## 2.3. AI Orchestrator & DX-DSL

AI Orchestrator là bộ não điều phối nối giữa lệnh ngôn ngữ tự nhiên của người dùng và hành động thực thi trên hệ thống. Sau khi LangChain + RAG phân tích ý định, Orchestrator chuyển đổi lệnh sang cấu trúc **DX-DSL (Domain Execution - Domain Specific Language)**.

Cấu trúc DSL chuẩn và danh sách action types được phép xem tại: **[`docs/dsl-spec.md`](./dsl-spec.md)**.

**Nguyên tắc Human-in-the-loop bắt buộc:** Bất kỳ DSL Command nào có `effect: write` (tác động thực thi — thay đổi dữ liệu, kích hoạt workflow) đều **PHẢI** gửi Interactive Message qua Mattermost để chờ phê duyệt của Ban Giám đốc trước khi thực thi. AI không được phép tự động bypass bước này.

---

## 3. Kiến trúc Đa khách hàng (Multi-Tenancy) & Phân quyền

Để Proteus OS có thể thương mại hoá dưới dạng SaaS bán cho nhiều tổ chức (trường học/doanh nghiệp) dùng chung trên 1 hệ thống đám mây, kiến trúc bảo mật được thiết kế như sau:

- **Cô lập Tài khoản (Keycloak Realms):** Sử dụng tính năng **Realms** của Keycloak. Mỗi khách hàng (Trường A, Doanh nghiệp B) là một Realm độc lập. Người dùng của Trường A không bao giờ đăng nhập chéo được vào Trường B.
- **Phân quyền Động (RBAC — 3 tầng):** Hệ thống có 3 tầng phân quyền rõ ràng:
  - **Platform Level** (`superadmin`, `platform_support`): ICTU Team, có quyền quản lý tất cả Tenant và Marketplace.
  - **Tenant Level** (`tenant_admin`): Admin của từng tổ chức, có quyền cài/gỡ Plugin và phân quyền người dùng **trong phạm vi Tenant của mình**.
  - **Plugin Level** (`hr_manager`, `leave_approver`, v.v.): Role được tạo tự động khi Plugin cài đặt, định nghĩa trong `manifest.yaml`. Người dùng chỉ thao tác nghiệp vụ, **không có quyền quản lý Plugin**.
  
  Token JWT mang theo Role → Frontend đọc để render Dynamic UI (giấu/hiện tính năng) → Backend đọc để enforce RBAC. Chi tiết xem tại [`docs/clarification.md §7`](./clarification.md).
- **Cô lập Dữ liệu (PostgreSQL Row-Level Security):** Toàn bộ dữ liệu nghiệp vụ của các tổ chức được lưu chung trên một Database (Shared-Schema) để tối ưu hóa tài nguyên và dễ dàng bảo trì. Hệ thống sử dụng cơ chế **Row-Level Security (RLS)** trên Postgres (thông qua cột `tenant_id`) để đảm bảo dữ liệu của tổ chức nào chỉ tổ chức đó truy cập được, an toàn tuyệt đối ở cấp độ cơ sở dữ liệu.
- **Cô lập Ứng dụng (App Store):** Trường A có thể mua và cài Plugin "Quản lý Canteen", hệ thống sẽ kích hoạt Plugin này vào Schema của Trường A. Trường B sẽ không nhìn thấy tính năng này nếu chưa mua.

---

## 4. Quyết định Kiến trúc (Architecture Decision Records)

### ADR-001: Chọn Redis làm Event Bus

**Ngày quyết định:** 2026-08-05  
**Trạng thái:** Đã chốt ✅

**Lý do lựa chọn Redis Pub/Sub thay vì RabbitMQ:**

| Tiêu chí | Redis Pub/Sub | RabbitMQ |
|---|---|---|  
| **RAM footprint** | ~50MB | ~200MB+ |
| **Độ phức tạp** | Đơn giản, ít config | Phức tạp, cần nhiều config |
| **Message durability** | Mất message nếu subscriber offline | Persistent, có ACK |
| **Phù hợp với use case** | Event-driven thông báo tức thì | Reliable task queue |

**Kết luận:** Trong Proteus OS, Event Bus chủ yếu dùng để **Plugin A phát sự kiện, Plugin B lắng nghe tức thì** (VD: HR tạo nhân viên mới → Finance tạo tài khoản lương). Đây là use case của fire-and-forget notification, không yêu cầu message durability. Redis Pub/Sub đủ dùng và nhẹ hơn nhiều so với RabbitMQ, giúp giảm yêu cầu RAM của toàn hệ thống.

**Lưu ý:** Nếu trong tương lai cần **reliable task queue** (VD: email gửi đi phải đảm bảo không mất), sẽ thêm **Redis Streams** (không phải Pub/Sub) hoặc nâng cấp lên RabbitMQ cho queue đó riêng biệt.
