# TÀI LIỆU ĐẶC TẢ YÊU CẦU NGHIỆP VỤ (BRD)

**Tên dự án:** Proteus OS
**Phiên bản:** 2.0
**Tầm nhìn:** *"Linux là hệ điều hành cho máy tính. Proteus OS là hệ điều hành cho doanh nghiệp."*

## 1. TỔNG QUAN DỰ ÁN

### 1.1 Bài toán hiện tại (Nỗi đau của Doanh nghiệp SME)
- **Ốc đảo thông tin:** Doanh nghiệp sử dụng nhiều phần mềm rời rạc (Chat, Email, ERP, HRM) không giao tiếp với nhau, gây ra tình trạng bẫy "rác đầu vào - rác đầu ra".
- **Thiếu tính tự động hóa:** Nhân viên phải nhập liệu lặp lại ở nhiều hệ thống, tốn thời gian chuyển giao thông tin thủ công giữa các bộ phận.
- **AI bị mù cục bộ:** Các chatbot AI hiện hành chỉ hoạt động dưới dạng hỏi-đáp văn bản dựa trên file upload lẻ tẻ, không có khả năng truy xuất "Nguồn sự thật duy nhất" của toàn doanh nghiệp để ra quyết định và thực thi lệnh.

### 1.2 Giải pháp Proteus OS
- Thiết kế một Hệ điều hành Doanh nghiệp (Proteus OS) áp dụng cấu trúc phân bổ quyền điều khiển H-P-D-I.
- **Kiến trúc Open-Core + Plugin:** Proteus OS đóng vai trò là hạt nhân trung tâm (Core). Các nghiệp vụ chuyên ngành (HR, Kế toán, Quản lý trường học) sẽ đóng gói thành dạng "Plugin" (qua `manifest.yaml`) cắm vào nền tảng.
- Chuyển giao quyền kiểm soát từ thao tác thủ công sang các thuật toán tự động và Tác tử tự hành (Agentic AI).

### 1.3 Phạm vi khai thác (Target Audience)
Theo định hướng xây dựng Trạm thực hành số (DX-Lab) của OLP, hệ thống phục vụ 3 nhóm đối tượng:
1. **Ban lãnh đạo, Quản lý SME & Cơ quan Nhà nước:** Ứng dụng khung đo lường chẩn đoán thực trạng tổ chức, tối ưu hóa ROI.
2. **Chuyên gia Công nghệ & Tư vấn viên:** Môi trường đóng gói, chia sẻ tri thức chuyên môn và kết nối mạng lưới tư vấn CĐS.
3. **Sinh viên & Giảng viên khối ngành kỹ thuật, kinh tế số:** Tiếp cận môi trường thực nghiệm giả lập trên cơ sở dữ liệu thực tế của doanh nghiệp.

## 2. YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS - FR)

Hệ thống được chia làm 2 phân hệ cốt lõi: **Phân hệ Tích hợp Open-Source (Proteus OS Base)** và **Phân hệ Đột phá (Innovation Layer)**.

### 2.1. Phân hệ 1: Hệ sinh thái Proteus OS Base (Tích hợp nguồn mở)

#### FR1. Không gian [H] - Môi trường làm việc số tích hợp
- **Mô tả:** Phân tầng giao tiếp cơ sở của con người, đảm bảo tính xác thực và chuẩn hóa thông tin đầu vào.
- **Luồng nghiệp vụ:**
  - Người dùng đăng nhập 1 lần qua Keycloak (SSO) -> Truy cập Portal chung.
  - Quản trị tri thức nội bộ qua hệ thống Wiki/CMS (ví dụ: Outline/BookStack).
  - Lưu trữ tài liệu quy trình, hợp đồng trên Nextcloud theo phương pháp P.A.R.A (Projects - Areas - Resources - Archives).
  - Nhận và gửi thông báo công việc qua kênh chat nội bộ Mattermost.
- **Tiêu chí nghiệm thu (AC):** Vô hiệu hóa được tài khoản nhân viên nghỉ việc trên tất cả các app (Chat, File, Dashboard) chỉ bằng 1 click trên Keycloak.

#### FR2. Không gian [P] - Tự động hóa luồng việc (Workflow Engine)
- **Mô tả:** Chuyển giao quy trình chạy bằng "cơm" sang quy trình chạy bằng thuật toán hướng sự kiện (Event-driven).
- **Luồng nghiệp vụ:** Nhập liệu qua biểu mẫu Appsmith/Budibase -> Hệ thống gọi Webhook tới n8n/Camunda -> Tự động rẽ nhánh logic (gửi email, nhắn tin Mattermost, lưu Database).
- **Rào chắn Poka-yoke:** Bắt buộc kiểm tra tính hợp lệ của dữ liệu ngay tại giao diện nhập liệu (VD: Chặn form xin phép nếu số ngày nghỉ > quỹ phép còn lại). Tuyệt đối không cho đẩy dữ liệu rác vào DB.
- **Tiêu chí nghiệm thu (AC):** Một quy trình (VD: duyệt chi) từ lúc trình form đến lúc hoàn tất không cần bất kỳ thao tác copy/paste hay gửi email thủ công nào.

#### FR3. Không gian [D] - Nguồn sự thật duy nhất (Unified DB)
- **Mô tả:** Quy hoạch rạch ròi 2 "mỏ vàng" dữ liệu để khai thác.
- **Phân loại luồng dữ liệu:**
  - **Dữ liệu có cấu trúc:** Dữ liệu từ [P] đẩy thẳng vào PostgreSQL, kết hợp ứng dụng Dữ liệu mở liên kết (LOD) để chuẩn hóa cấu trúc siêu dữ liệu, hình thành Nguồn sự thật duy nhất.
  - **Dữ liệu phi cấu trúc:** File PDF, ảnh từ [H] đẩy về Nextcloud và Vector DB.
- **Lược đồ Dữ liệu (Data Model Concept):** Khởi tạo Lược đồ Thực thể Liên kết (ERD) cấp cao để map các bảng lõi (`Users`, `Tenants`, `Roles`) giao tiếp với dữ liệu nghiệp vụ của Plugin, đảm bảo tính vẹn toàn dữ liệu.
- **Thang đo phân tích (Dashboard Metabase):** Bắt buộc hiển thị đủ 3 cấp độ:
  - *Mô tả (Chuyện gì đã xảy ra):* Thẻ số hiển thị tổng task hoàn thành, tổng đơn nghỉ phép.
  - *Chẩn đoán (Tại sao xảy ra):* Biểu đồ tỷ lệ nguyên nhân gây trễ SLA của từng phòng ban.
  - *Dự báo (Điều gì sắp xảy ra):* Biểu đồ Trendline dự báo nguy cơ dòng tiền âm trong tháng tới.
- **Tiêu chí nghiệm thu (AC):** Metabase truy vấn trực tiếp từ PostgreSQL thời gian thực (< 2 giây), không dùng file Excel trung gian.

#### FR4. Không gian [I] - Trí tuệ nhân tạo Tự hành (Doanh nghiệp AI-Native)
Đây là phân tầng cao nhất, bao gồm 3 lõi chức năng chính:

**FR4.1. Xử lý tri thức và Bộ nhớ độ sâu (RAG System):**
- **Mô tả:** Xây dựng hệ thống Truy xuất Cốt lõi (Retrieval-Augmented Generation) để AI "học" văn bản của doanh nghiệp.
- **Luồng xử lý:** Hệ thống tự động đồng bộ tài liệu từ Không gian [H] -> Băm nhỏ văn bản (Chunking) -> Chuyển hóa vector (Embedding) -> Lưu trữ tĩnh tại Qdrant/Milvus.
- **Tiêu chí nghiệm thu (AC):** AI trả lời chính xác dựa trên tài liệu đã nạp, có trích dẫn nguồn gốc và không bị "ảo giác" (hallucination).

**FR4.2. Tác tử Giám sát & Chẩn đoán Sự cố (Proactive Diagnostic Agent):**
- **Mô tả:** Một Tác tử AI hoạt động ngầm (chạy nền 24/7) đóng vai trò Kiểm soát viên.
- **Luồng xử lý:** Quét dữ liệu giao dịch từ PostgreSQL [D] -> Phát hiện điểm nghẽn (VD: Đơn hàng quá hạn) -> Đối chiếu Quy trình chuẩn từ Vector DB để tìm nguyên nhân gốc rễ -> Lập báo cáo.
- **Tiêu chí nghiệm thu (AC):** Hệ thống tự động gửi tin nhắn cảnh báo vào nhóm Mattermost của Quản lý: *"Cảnh báo: Đơn hàng #1024 trễ 24h. Nguyên nhân kẹt ở bước Chờ chữ ký Kế toán."*

**FR4.3. Tác tử Thực thi Ủy quyền (Executive Action Agent):**
- **Mô tả:** Cấp quyền cho AI trực tiếp can thiệp vào hệ thống (gọi API) để giải quyết vấn đề.
- **Luồng xử lý:** Nhận lệnh ủy quyền bằng ngôn ngữ tự nhiên từ Ban Giám đốc qua Chat (VD: "Hãy điều chuyển kho để bù hàng") -> Phân tích logic bằng ReAct (Reasoning and Acting) -> Dịch lệnh thành chuẩn DX-DSL -> Gửi tin nhắn xác nhận (Interactive Message) có nút [Phê duyệt]/[Hủy] qua Mattermost (Human-in-the-loop) -> Giám đốc bấm [Phê duyệt] -> Tự động kích hoạt luồng Workflow tương ứng tại Không gian [P].
- **Tiêu chí nghiệm thu (AC):** AI tự động hoàn thành một quy trình thông qua API và báo cáo kết quả hoàn tất về cho người ra lệnh trên Chat.

### 2.2. Phân hệ 2: Innovation Layer (Phần lõi tự phát triển - Trọng tâm thi đấu)

#### FR5. Proteus OS Plugin Manager & Marketplace
- **Mô tả:** Hệ thống cốt lõi do đội tự code (Python/Node.js) để quản lý vòng đời của các Plugin. Bao gồm một giao diện Web "App Store" (Marketplace) để quản trị viên cài đặt các module nghiệp vụ chỉ bằng một cú click chuột.
- **Luồng xử lý:** Quản trị viên bấm nút "Cài đặt" trên giao diện Marketplace (hoặc dùng lệnh `proteus-os install`) -> Hệ thống đọc file `manifest.yaml` của Plugin -> Tự động gọi API Postgres để tạo bảng (Table) -> Gọi API n8n để nạp luồng quy trình (Blueprint) -> Gọi API Metabase để tạo Dashboard.
- **Tự động phục hồi (Auto-Rollback):** Tích hợp cơ chế Transaction. Nếu có bất kỳ bước gọi API nào (DB, n8n, Metabase) bị lỗi giữa chừng, hệ thống sẽ tự động Rollback (xóa các thành phần đã tạo) để trả môi trường về trạng thái sạch.
- **Tiêu chí nghiệm thu (AC):** Chỉ với 1 thao tác cài đặt, toàn bộ hạ tầng DB, Workflow và Report của nghiệp vụ đó được khởi tạo thành công trong vòng 30 giây mà không cần thao tác tay. Nếu có lỗi gián đoạn, hệ thống tự thu hồi không để lại dữ liệu rác.

#### FR6. AI Orchestrator & Workflow DSL (Domain Specific Language)
- **Mô tả:** Bộ thông dịch tự viết giúp kết nối "Não" của AI với "Chân tay" của hệ thống quản lý.
- **Luồng xử lý:** AI xuất ra cấu trúc thực thi DSL (Ví dụ JSON) -> Orchestrator xác thực quyền của người ra lệnh (qua token SSO) -> Gọi trực tiếp Webhook/API của n8n để chạy luồng.
- **Tiêu chí nghiệm thu (AC):** Mã nguồn của Orchestrator xử lý mượt mà các chuỗi lệnh phức tạp và bắt được lỗi nếu AI sinh ra cấu trúc lệnh sai chuẩn.

## 3. YÊU CẦU PHI CHỨC NĂNG (NFR) - RÀO CHẮN ĐIỂM SỐ PoF

- **NFR1. Giấy phép nguồn mở (OSI-Approved):** Toàn bộ mã nguồn tự phát triển (Innovation Layer) phải gắn giấy phép MIT/Apache 2.0 ở đầu mỗi tệp tin. Phải có file LICENSE toàn văn ở thư mục gốc. Không sửa mã nguồn lõi của thư viện bên thứ 3.
- **NFR2. Môi trường triển khai (Build From Source):** Hệ thống phải được Container hóa toàn bộ bằng Docker & Docker Compose. Cung cấp file `setup.sh` chạy 1-click.
- **NFR3. Quản lý kho mã nguồn:** Bắt buộc lưu trữ Public trên GitHub. Phải có tài liệu `README.md` siêu chi tiết, `CHANGELOG.md`, và sử dụng chức năng Issue (Bug tracker).
- **NFR4. API First:** Các thành phần giao tiếp 100% qua RESTful API, có tài liệu Swagger.
- **NFR5. Ghi Log tập trung (Logging):** Hệ thống phải có cơ chế ghi Log lỗi tập trung (Ví dụ sử dụng ELK stack hoặc Grafana Loki) để theo dõi quá trình cài đặt Plugin và hoạt động của AI.
- **NFR6. Sao lưu và Phục hồi (Backup & Recovery):** Đảm bảo tính liên tục của doanh nghiệp (Business Continuity) bằng cách thiết lập cronjob tự động sao lưu PostgreSQL và Nextcloud định kỳ.

## 4. NGĂN XẾP CÔNG NGHỆ (TECH STACK) ĐỀ XUẤT

Để đảm bảo khả năng triển khai độc lập bằng Docker (NFR2) và tối ưu hóa cho AI, dự án đề xuất sử dụng ngăn xếp công nghệ sau:

### 4.1. Phân hệ Tích hợp Open-Source (Các công cụ lắp ghép)
- **Không gian [H] (Nhân sự):**
  - Quản lý Định danh (SSO): **Keycloak** (Tiêu chuẩn OAuth2/OIDC, bảo mật cao).
  - Nhắn tin nội bộ (Chat): **Mattermost** (Hỗ trợ Webhook và Interactive Buttons cho AI).
  - Lưu trữ file: **Nextcloud**.
  - Wiki/CMS: **Outline** (Viết bằng Markdown, giao diện hiện đại).
- **Không gian [P] (Quy trình):**
  - Tự động hóa Workflow: **n8n** (Hỗ trợ xuất/nhập luồng dạng JSON, phù hợp để đóng gói Plugin).
  - Low-code UI: **Appsmith** (Kết nối trực tiếp API/DB dễ dàng).
- **Không gian [D] (Dữ liệu):**
  - Cơ sở dữ liệu: **PostgreSQL** (Lưu trữ cả dữ liệu quan hệ và JSON).
  - Dashboard: **Metabase** (Trực quan hóa dữ liệu mạnh mẽ).
- **Không gian [I] (AI):**
  - Vector Database: **Qdrant** (Nhẹ, mã nguồn mở, tối ưu cho RAG).

### 4.2. Phân hệ Đột phá - Innovation Layer (Phần lõi tự phát triển)
- **Backend (Core API & AI Orchestrator):** Sử dụng **Python (FastAPI)**. Tốc độ xử lý nhanh, tự động sinh tài liệu Swagger, dễ dàng tích hợp thư viện AI (LangChain).
- **Frontend (Giao diện App Store):** Sử dụng **Next.js (React)** để tạo trải nghiệm mượt mà, thân thiện.
- **Cơ sở hạ tầng & Triển khai (DevOps):** Đóng gói toàn bộ bằng **Docker Compose**. Định tuyến tự động bằng **Traefik Proxy**.

## 5. THIẾT KẾ KIẾN TRÚC MÃ NGUỒN & TRIỂN KHAI (SAD)

Để đáp ứng tiêu chuẩn quản lý mã nguồn của cuộc thi, dự án tổ chức thành một Monorepo với cấu trúc thư mục như sau:

```text
Proteus-OS-Monorepo/
│
├── deploy/                      # 1. KHÔNG GIAN TRIỂN KHAI (DevOps)
│   ├── docker-compose.yml       # Tệp định nghĩa hạ tầng (Postgres, n8n, Keycloak...)
│   ├── .env.example             # Biến môi trường mẫu
│   └── setup.sh                 # Script chạy 1-click cho Ban giám khảo (Build from Source)
│
├── core-engine/                 # 2. INNOVATION LAYER (Sản phẩm đội tự code)
│   ├── backend/                 # API & AI Orchestrator (FastAPI)
│   │   ├── api/                 # API Routes
│   │   ├── orchestrator/        # Bộ thông dịch AI
│   │   └── requirements.txt     # Thư viện phụ thuộc Python
│   ├── frontend/                # App Store Marketplace UI (Next.js)
│   │   ├── src/                 # Mã nguồn React components
│   │   └── package.json         # Thư viện phụ thuộc Node.js
│   ├── tests/                   # Kịch bản kiểm thử (Unit tests) giúp ghi điểm PoF
│   └── Dockerfile               # Tệp đóng gói Multi-stage build cho Core Engine
│
├── plugins/                     # 3. KHO PHÂN HỆ NGHIỆP VỤ MỞ RỘNG
│   ├── hr-module/
│   │   ├── manifest.yaml        # Siêu dữ liệu (Tên, version, quyền truy cập...)
│   │   ├── db/
│   │   │   └── seed_data.sql    # Khởi tạo bảng & dữ liệu mẫu (PostgreSQL)
│   │   ├── workflows/           
│   │   │   └── leave_request.json # Luồng quy trình n8n (Export file JSON)
│   │   ├── dashboards/
│   │   │   └── hr_metrics.json  # Biểu đồ báo cáo Metabase (Export file JSON)
│   │   └── ui/
│   │       └── appsmith_app.json # Giao diện màn hình nhập liệu (Appsmith export)
│   └── finance-module/
│
├── docs/                        # 4. TÀI LIỆU DỰ ÁN
│   ├── architecture.md          # Sơ đồ kiến trúc tổng thể (SAD)
│   ├── ui_ux_design.md          # Phác thảo giao diện Launchpad & App Store
│   ├── erd.md                   # Lược đồ cơ sở dữ liệu cốt lõi (Core ERD)
│   ├── clarification.md         # Làm rõ kiến trúc Đa khách hàng & Phân quyền
│   ├── api-swagger.yaml         # Tài liệu API của Core Engine
│   └── images/                  # Thư mục chứa hình ảnh tài liệu
│
├── LICENSE                      # BẮT BUỘC: Giấy phép nguồn mở (MIT/Apache 2.0)
├── README.md                    # Hướng dẫn chi tiết cách build, run và test
└── CHANGELOG.md                 # Ghi chú các bản cập nhật phiên bản
```
