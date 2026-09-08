# Hướng dẫn Biên dịch & Cài đặt từ Mã nguồn (Building from Source)

Tài liệu này cung cấp hướng dẫn đầy đủ, chi tiết về cách cấu hình, biên dịch và chạy **Proteus OS** hoàn toàn từ mã nguồn mở (Build from Source), đáp ứng 100% các tiêu chí đánh giá phần mềm nguồn mở (PoF).

---

## 1. Nguyên tắc Biên dịch & Cấu hình (Core Principles)

Dự án tuân thủ nghiêm ngặt các quy chuẩn của phần mềm nguồn mở quốc tế:

1. **Cấu hình trước khi dịch (Pre-build Configuration):**
   - Mọi cấu hình tham số hệ thống, cổng mạng, kết nối cơ sở dữ liệu, secret keys đều được định nghĩa thông qua **Biến môi trường (Environment Variables)** trong tệp `.env`.
   - **Tuyệt đối không yêu cầu người dùng sửa thủ công vào mã nguồn hay các tệp header** trước khi biên dịch.
2. **Sử dụng 100% Công cụ Nguồn Mở chuẩn (Open-Source Toolchains):**
   - **Backend:** CPython 3.12 (Giấy phép Python Software Foundation - PSF), `pip`, `venv`.
   - **Frontend:** Node.js 20+ (Node.js License/MIT), `npm` (npm Open Source License).
   - **Containerization:** Docker CE (Apache 2.0), Docker Compose (Apache 2.0).
   - **Tuyệt đối không dùng bất kỳ công cụ nguồn đóng hoặc phần mềm dịch độc quyền tự tạo nào.**
3. **Khả năng chạy độc lập ngoài thư mục mã nguồn (Out-of-Tree / Portable Execution):**
   - Sản phẩm sau khi đóng gói (Docker Images hoặc standalone build) có thể chạy độc lập trên bất kỳ máy chủ nào mà không phụ thuộc vào đường dẫn của thư mục mã nguồn ban đầu.

---

## 2. Yêu cầu Môi trường (Prerequisites)

Để dịch và chạy từ mã nguồn, máy tính cần cài đặt các công cụ mã nguồn mở sau:

- **Git** (GPLv2)
- **Docker Community Edition (Docker CE)** v24.0+ & **Docker Compose** v2.20+
- Hoặc nếu dịch thủ công trên máy thật (Bare-metal):
  - **Python** 3.12+ (PSF License)
  - **Node.js** 20.x hoặc 22.x LTS (MIT License)
  - **PostgreSQL** 16+ (PostgreSQL License)
  - **Redis** 7+ (BSD-3-Clause)

---

## 3. Cách 1: Biên dịch & Triển khai nhanh qua Docker (Khuyến nghị)

Đây là phương thức chuẩn hóa giúp biên dịch cả Backend (FastAPI) và Frontend (Next.js) từ mã nguồn sạch trong các container độc lập:

### Bước 1: Lấy mã nguồn
```bash
git clone https://github.com/CuongKenn/ICTU_Proteus-os.git
cd ICTU_Proteus-os
```

### Bước 2: Cấu hình trước khi dịch (Pre-configuration)
Khởi tạo tệp cấu hình môi trường từ mẫu có sẵn:
```bash
cp deploy/.env.example deploy/.env
```
Chỉnh sửa các giá trị secret nếu cần (mặc định môi trường development đã được cấu hình sẵn các giá trị an toàn cho môi trường test local).

### Bước 3: Biên dịch toàn bộ mã nguồn và khởi chạy
- **Trên Linux / macOS:**
  ```bash
  cd deploy
  ./setup.sh
  ```
- **Trên Windows (PowerShell):**
  ```powershell
  .\deploy\setup.ps1
  ```
- **Hoặc dùng lệnh Docker Compose trực tiếp:**
  ```bash
  docker compose -f deploy/docker-compose.yml up -d --build
  ```

Docker sẽ tự động biên dịch:
- Image `deploy-backend`: Cài đặt các gói Python từ `core-engine/backend/requirements.txt`.
- Image `deploy-frontend`: Chạy `npm ci` và `npm run build` tạo bản phân phối Next.js Standalone tối ưu.

---

## 4. Cách 2: Biên dịch và Chạy thủ công trên Máy phát triển (Bare-Metal Build)

Nếu bạn muốn dịch và chạy từng thành phần mà không dùng Docker:

### 4.1. Biên dịch Backend (FastAPI Python)

```bash
cd core-engine/backend

# 1. Khởi tạo môi trường ảo Python
python3.12 -m venv venv

# Kích hoạt môi trường ảo
# Trên Linux/macOS:
source venv/bin/activate
# Trên Windows:
.\venv\Scripts\Activate.ps1

# 2. Cài đặt các thư viện phụ thuộc
pip install --upgrade pip
pip install -r requirements.txt

# 3. Cấu hình biến môi trường
export DATABASE_URL="postgresql+asyncpg://proteus:proteus@localhost:5432/proteus"
export REDIS_URL="redis://localhost:6379"
export ENVIRONMENT="development"

# 4. Thực thi migrations cơ sở dữ liệu
alembic upgrade head

# 5. Khởi chạy Backend Server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend API sẽ sẵn sàng tại `http://localhost:8000` (Tài liệu OpenAPI/Swagger tại `http://localhost:8000/docs`).

### 4.2. Biên dịch Frontend (Next.js React)

```bash
cd core-engine/frontend

# 1. Cài đặt dependencies sạch từ lockfile
npm ci

# 2. Biên dịch mã nguồn Frontend thành gói phân phối Production
npm run build

# 3. Chạy ứng dụng đã biên dịch
npm run start
# Hoặc chạy ở chế độ phát triển (Development):
npm run dev
```

Frontend giao diện Launchpad sẽ sẵn sàng tại `http://localhost:3000`.

---

## 5. Kiểm thử Tự động sau khi Biên dịch (Post-build Testing)

Để đảm bảo toàn bộ mã nguồn được biên dịch chính xác và không có lỗi hồi quy:

```bash
# Chạy Unit Tests cho Backend:
cd core-engine/backend
pytest tests/unit --cov=app

# Chạy Unit Tests cho Frontend:
cd core-engine/frontend
npx vitest run
```
