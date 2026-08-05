# Hướng dẫn Triển khai & Cấu hình Hạ tầng (Deployment Guide)

Tài liệu này mô tả chi tiết cách thức triển khai toàn bộ hệ sinh thái **Proteus OS** sử dụng Docker Compose, cơ chế định tuyến (Routing) qua Traefik, và các yêu cầu về phần cứng (Hardware Requirements).

---

## 1. Yêu cầu Cấu hình Phần cứng (Hardware Requirements)

Vì Proteus OS là một hệ sinh thái khổng lồ chạy nhiều dịch vụ cùng lúc (Keycloak, Mattermost, n8n, Appsmith, PostgreSQL, v.v.), việc cấp phát tài nguyên đầy đủ là bắt buộc để hệ thống không bị crash do thiếu RAM.

### 1.1. Cấu hình Khuyến nghị (Production/Staging)
Dành cho một tổ chức quy mô vừa (khoảng 100 - 500 nhân sự):
- **CPU:** Tối thiểu 8 Cores (Khuyến nghị 16 Cores)
- **RAM:** Tối thiểu 16GB (Khuyến nghị 32GB)
- **Storage:** Tối thiểu 100GB NVMe SSD (để đảm bảo tốc độ đọc/ghi cho Database và RAG/Vector DB)
- **OS:** Ubuntu 22.04 LTS hoặc 24.04 LTS

### 1.2. Cấu hình Môi trường Phát triển (Local/Development)
Dành cho lập trình viên chạy thử nghiệm (có thể tắt bớt một số dịch vụ không cần thiết):
- **CPU:** 4 Cores
- **RAM:** Tối thiểu 12GB
- Tăng cấu hình cấp phát (Resource Limits) cho Docker Desktop nếu sử dụng Windows/Mac.

---

## 2. Kiến trúc Mạng & Định tuyến (Network & Routing)

### 2.1. Traefik Proxy - Trái tim của Hệ thống Mạng
Để giải quyết bài toán giao tiếp giữa các dịch vụ, nhúng Iframe an toàn (vượt rào cản SameSite Cookie), và cung cấp HTTPS tự động, Proteus OS sử dụng **Traefik Proxy** làm cửa ngõ duy nhất (Edge Router).

*   **Ports:** Traefik là dịch vụ duy nhất được phép "mở" cổng (Bind) ra bên ngoài tại Port `80` (HTTP) và `443` (HTTPS). Tất cả các dịch vụ khác (Keycloak, n8n, Appsmith) chỉ giao tiếp nội bộ trong Docker Network.
*   **Single-Domain Path-Based Routing:** Để các ứng dụng có thể chia sẻ Cookie bảo mật với nhau (đặc biệt quan trọng cho Single Sign-On và Iframe), toàn bộ hệ thống chạy trên **CÙNG MỘT TÊN MIỀN GỐC** (Ví dụ: `proteus.local`). Traefik sẽ định tuyến dựa vào Path (đường dẫn):
    - `https://proteus.local/` 👉 Chuyển về **Next.js App Shell (Launchpad)**
    - `https://proteus.local/api/` 👉 Chuyển về **FastAPI Core Engine**
    - `https://proteus.local/auth/` 👉 Chuyển về **Keycloak**
    - `https://proteus.local/chat/` 👉 Chuyển về **Mattermost**
    - `https://proteus.local/proxy/appsmith/` 👉 Chuyển về **Appsmith** (Để nhúng Iframe)

### 2.2. Sơ đồ Mạng (Docker Network Diagram)

```mermaid
graph TD
    Internet((Internet)) -->|Port 443| Traefik[Traefik Proxy]
    
    subgraph Docker Network [Proteus-Network (Internal)]
        Traefik -->|/| UI[Next.js App Shell]
        Traefik -->|/api| Core[FastAPI Core Engine]
        Traefik -->|/auth| Keycloak[Keycloak]
        Traefik -->|/proxy/appsmith| Appsmith[Appsmith]
        Traefik -->|/chat| Mattermost[Mattermost]
        
        Core --> PG[(PostgreSQL)]
        Keycloak --> PG
        Appsmith --> PG
    end
    
    classDef internal fill:#2d3748,stroke:#4a5568,color:#e2e8f0;
    class PG,UI,Core,Keycloak,Appsmith,Mattermost internal;
```

---

## 3. Cấu hình Khởi chạy (1-Click Deployment)

Dự án cung cấp một file `setup.sh` để tự động hóa toàn bộ quá trình thiết lập.

### Bước 1: Khởi tạo biến môi trường
Tạo file `.env` từ file mẫu:
```bash
cp deploy/.env.example deploy/.env
```
*(Chỉnh sửa các mật khẩu và thiết lập tên miền `DOMAIN=proteus.local` trong file `.env`)*

### Bước 2: Khởi chạy hệ thống
Chạy script tự động thiết lập quyền (permissions), khởi tạo thư mục mount và bật Docker Compose:
```bash
cd deploy
bash setup.sh
```

### Bước 3: Cấu hình Local DNS (Dành cho Development)
Nếu chạy ở môi trường Local (chưa có tên miền thật), bạn cần trỏ tên miền ảo về `localhost` bằng cách sửa file `/etc/hosts` (trên Linux/Mac) hoặc `C:\Windows\System32\drivers\etc\hosts` (trên Windows):
```text
127.0.0.1 proteus.local
```

### Bước 4: Kiểm tra trạng thái
Kiểm tra xem tất cả các container đã `Up` và trạng thái `Healthy` chưa:
```bash
docker-compose ps
```

---

## 4. Bảo mật & Quản lý Dữ liệu (Volumes)

- **Persistent Volumes:** Tất cả dữ liệu quan trọng (PostgreSQL data, Qdrant vectors, Mattermost files, Nextcloud data) đều được map ra ngoài thư mục vật lý thông qua Docker Volumes để đảm bảo dữ liệu không bị mất khi khởi động lại container.
- **SSL/TLS:** Mặc định, Traefik được cấu hình sử dụng Let's Encrypt (DNS Challenge) để tự động cấp phát và gia hạn chứng chỉ SSL, đảm bảo mọi giao tiếp đều mã hóa qua HTTPS.
