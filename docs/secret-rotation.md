# Hướng dẫn Rotate Secret và Purge Lịch sử Git (Secret Rotation & Purge Runbook)

Tài liệu này cung cấp quy trình vận hành tiêu chuẩn (SOP) để:
1. Đổi mới (rotate) toàn bộ secret và mật khẩu quản trị trong hệ thống Proteus OS.
2. Thiết lập quyền an toàn cho tệp cấu hình môi trường (`.env`).
3. Quy trình loại bỏ vĩnh viễn (purge) các secret cũ khỏi lịch sử commit Git của dự án khi phối hợp với đội ngũ.

---

## 1. Nguyên tắc An toàn Cốt lõi

- **Không commit file `.env`**: File `.env` chứa secret vận hành thực tế, tuyệt đối không commit lên bất kỳ branch nào (đã được cấu hình trong `.gitignore` và `deploy/.gitignore`).
- **Quyền truy cập tệp**: File `.env` trên máy chủ phải được giới hạn quyền `600` (chỉ user sở hữu có quyền đọc/ghi):
  ```bash
  chmod 600 deploy/.env
  ```
- **Không sử dụng mật khẩu mặc định**: Tuyệt đối không sử dụng mật khẩu mặc định (như `admin`, `CHANGE_ME...`) trên môi trường staging và production.
- **Tạo secret mạnh bằng công cụ mã hóa**:
  ```bash
  # Sinh chuỗi hex 32 bytes (64 ký tự)
  openssl rand -hex 32

  # Sinh chuỗi base64 32 bytes
  openssl rand -base64 32
  ```

---

## 2. Quy trình Rotate Secret Từng Thành phần

Khi nghi ngờ secret bị lộ hoặc theo chu kỳ kiểm toán định kỳ, hãy thực hiện rotate theo các bước sau:

### 2.1. Cơ sở dữ liệu PostgreSQL (`POSTGRES_PASSWORD`)
1. Sinh mật khẩu mới:
   ```bash
   NEW_PG_PASS=$(openssl rand -hex 16)
   ```
2. Đổi mật khẩu trong database PostgreSQL:
   ```bash
   docker exec -it proteus-postgres psql -U proteus -c "ALTER USER proteus WITH PASSWORD '$NEW_PG_PASS';"
   ```
3. Cập nhật `POSTGRES_PASSWORD=$NEW_PG_PASS` trong `deploy/.env`.
4. Khởi động lại các container phụ thuộc database (backend, metabase, n8n, mattermost, outline):
   ```bash
   docker compose up -d --force-recreate backend metabase n8n mattermost outline
   ```

### 2.2. Redis Cache (`REDIS_PASSWORD`)
1. Sinh mật khẩu mới và cập nhật `REDIS_PASSWORD` trong `deploy/.env`.
2. Khởi động lại Redis và các container sử dụng Redis:
   ```bash
   docker compose up -d --force-recreate redis backend
   ```

### 2.3. Keycloak Admin & Client Secrets
1. **Mật khẩu Keycloak Admin (`KEYCLOAK_ADMIN_PASSWORD`)**:
   - Đăng nhập Keycloak Admin Console (`https://<DOMAIN>/auth` hoặc `http://localhost:8080`).
   - Vào **Users** > chọn user admin > tab **Credentials** > đặt mật khẩu mới.
   - Cập nhật `KEYCLOAK_ADMIN_PASSWORD` trong `deploy/.env`.
2. **Client Secret (`KEYCLOAK_BFF_CLIENT_SECRET`, `APPSMITH_OIDC_SECRET`, `OUTLINE_OIDC_SECRET`)**:
   - Vào **Clients** trong Keycloak Admin UI > chọn client (ví dụ `proteus-bff`).
   - Tab **Credentials** > nhấn **Regenerate Secret**.
   - Cập nhật secret mới tương ứng vào `deploy/.env`.
   - Khởi động lại service frontend/appsmith/outline.

### 2.4. Next.js BFF Secret (`NEXTAUTH_SECRET`)
1. Sinh secret mới:
   ```bash
   openssl rand -base64 32
   ```
2. Cập nhật `NEXTAUTH_SECRET` trong `deploy/.env`.
3. Khởi động lại container `frontend`:
   ```bash
   docker compose restart frontend
   ```
   *Lưu ý: Thao tác này sẽ yêu cầu người dùng đang đăng nhập phải login lại.*

### 2.5. n8n Encryption Key & API Key
1. **N8N_API_KEY**:
   - Truy cập n8n UI > **Settings** > **API**.
   - Tạo API Key mới, thu hồi (revoke) key cũ.
   - Cập nhật `N8N_API_KEY` trong `deploy/.env` và khởi động lại `backend`.
2. **N8N_ENCRYPTION_KEY**:
   - *Cảnh báo: Thay đổi key mã hóa n8n sẽ khiến các credentials đã lưu trong n8n không thể giải mã.*
   - Nếu cần rotate, hãy export credentials từ n8n trước khi đổi key hoặc cập nhật lại credentials sau khi đổi.

### 2.6. Metabase Secret Key (`METABASE_SECRET_KEY`)
1. Sinh secret mới:
   ```bash
   openssl rand -hex 32
   ```
2. Cập nhật trong `deploy/.env`.
3. Khởi động lại `metabase` và `backend`.

### 2.7. Grafana Password (`GRAFANA_PASSWORD`)
1. Đổi mật khẩu admin qua CLI Grafana trong container:
   ```bash
   docker exec -it proteus-grafana grafana-cli admin reset-admin-password <MAT_KHAU_MOI>
   ```
2. Cập nhật `GRAFANA_PASSWORD` trong `deploy/.env`.

### 2.8. Outline Secret Keys (`OUTLINE_SECRET_KEY`, `OUTLINE_UTILS_SECRET`)
1. Sinh 2 secret hex 32 ngẫu nhiên độc lập:
   ```bash
   openssl rand -hex 32
   openssl rand -hex 32
   ```
2. Cập nhật vào `deploy/.env` và khởi động lại Outline:
   ```bash
   docker compose restart outline
   ```

---

## 3. Quy trình Purge Secret Khỏi Lịch sử Git (Runbook)

Khi một commit cũ vô tình đưa file `.env` chứa secret vào lịch sử Git, việc xóa file ở commit sau không làm biến mất secret trong lịch sử. Cần thực hiện quy trình Purge theo lịch bảo trì hệ thống:

> [!CAUTION]
> Thao tác viết lại lịch sử Git làm thay đổi hash commit. BẮT BUỘC phải thông báo cho toàn bộ thành viên trong nhóm, tạm dừng merge PR, và sao lưu repository trước khi thực hiện.

### Bước 1: Sao lưu Repository
Tạo một bản sao mirror hoàn chỉnh trước khi can thiệp:
```bash
git clone --mirror git@github.com:CuongKenn/ICTU_Proteus-os.git proteus-os-backup.git
```

### Bước 2: Sử dụng `git-filter-repo` để xóa triệt để file `.env`
Cài đặt `git-filter-repo` (yêu cầu Python 3):
```bash
pip install git-filter-repo
```

Thực hiện purge file `deploy/.env` khỏi toàn bộ lịch sử commit:
```bash
# Clone một bản làm việc mới dành riêng cho thao tác filter
git clone git@github.com:CuongKenn/ICTU_Proteus-os.git proteus-filter
cd proteus-filter

# Xóa bỏ file deploy/.env trong mọi commit trong quá khứ
git filter-repo --path deploy/.env --invert-paths
```

### Bước 3: Kiểm tra lại lịch sử
Xác nhận rằng không còn vết tích của file `deploy/.env`:
```bash
git log --all --full-history -- "deploy/.env"
# Kết quả rỗng là đạt yêu cầu
```

### Bước 4: Đồng bộ lên Remote (Maintenance Window)
Chỉ thực hiện trong khung giờ bảo trì sau khi các thành viên đã push hết branch cá nhân:
```bash
git remote add origin git@github.com:CuongKenn/ICTU_Proteus-os.git
git push origin --force --all
git push origin --force --tags
```

### Bước 5: Hướng dẫn cho Thành viên Nhóm Sau khi Purge
Các lập trình viên cần re-clone lại repository hoặc rebase nhánh của mình:
```bash
# Khuyến nghị: Clone mới
git clone git@github.com:CuongKenn/ICTU_Proteus-os.git
```
