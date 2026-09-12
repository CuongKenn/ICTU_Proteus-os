# Hướng dẫn Demo Hệ thống Proteus OS trước Hội đồng

Tài liệu này cung cấp kịch bản chuẩn hóa để trình diễn các tính năng cốt lõi của Proteus OS, tập trung vào Kiến trúc Enterprise, Multi-Tenancy, Micro-Kernel và Agentic AI với Human-in-the-loop.

## 1. Công tác Chuẩn bị (Trước giờ G)
- **Data giả (Seeding):** Chuẩn bị sẵn ít nhất 2 Tenant (VD: Công ty A, Công ty B), một số User, và sẵn 1-2 Plugin trong Marketplace.
- **Mở sẵn các Tab trình duyệt:** 
  - Tab 1: Giao diện Web Proteus OS (Frontend).
  - Tab 2: Keycloak Admin (để backup trả lời câu hỏi về SSO/IAM).
  - Tab 3: Mattermost (App hoặc Web) đăng nhập sẵn tài khoản Giám đốc/Admin có quyền duyệt.
  - Tab 4: Metabase / n8n (Dashboard/Workflow để minh hoạ iframe).
- **Video Backup:** Cần quay màn hình sẵn một luồng chạy hoàn chỉnh đề phòng mạng lỗi hoặc server sập lúc đang demo trực tiếp.
- **Biến môi trường:** Đảm bảo file `.env` đã có đủ `MATTERMOST_URL` và `MATTERMOST_BOT_TOKEN`.

---

## 2. Phần 1: Giới thiệu Tổng quan (3 Phút)
- **Vấn đề (Pain point):** Doanh nghiệp hiện nay dùng quá nhiều phần mềm rời rạc (Silo), chi phí cao, dữ liệu phân mảnh.
- **Giải pháp - Proteus OS:** Một hệ điều hành doanh nghiệp (Enterprise OS) hợp nhất.
- **Các "Từ khóa" ăn điểm cần nhắc đến:**
  - *Micro-kernel & Plugin-based:* Lõi siêu nhẹ, cần gì cài nấy (như App Store).
  - *Multi-tenancy:* Một hệ thống phục vụ nhiều công ty nhưng dữ liệu cô lập hoàn toàn (SaaS-ready).
  - *Agentic AI với Human-in-the-loop:* AI thông minh nhưng con người giữ quyền kiểm soát cuối cùng (an toàn tuyệt đối).

---

## 3. Phần 2: Các Kịch bản Demo Thực Tế (10-15 Phút)

### Kịch bản 1: Hệ sinh thái hợp nhất & Multi-Tenancy (Bảo mật dữ liệu)
- **Hành động:** Đăng nhập vào hệ thống qua màn hình Keycloak (SSO).
- **Hành động:** Chuyển đổi giữa 2 Tenant (Công ty A và Công ty B) bằng 2 tài khoản khác nhau.
- **Thuyết minh:** *"Thưa hội đồng, nhờ cơ chế Single Sign-On của Keycloak và Row-Level Security ở tầng Database (PostgreSQL RLS), dữ liệu của Công ty A và Công ty B hoàn toàn độc lập dù chạy chung một Database duy nhất. Ngay cả khi có bug ở tầng Application, dữ liệu vẫn an toàn ở tầng vật lý."*

### Kịch bản 2: Kiến trúc Micro-Kernel & Plugin Marketplace (Tính linh hoạt)
- **Hành động:** Mở chức năng Marketplace.
- **Hành động:** Bấm "Cài đặt" một Plugin (VD: HR Module). Theo dõi thanh tiến trình. F5 lại trang và thấy Menu Nhân sự hiện ra.
- **Thuyết minh:** *"Khác với các hệ thống Monolith (nguyên khối) cũ, Proteus OS có kiến trúc lõi vi mô (Micro-Kernel). Việc cài thêm phân hệ diễn ra như cài App trên điện thoại. Hệ thống tự động tạo RLS, migration DB động và inject UI mà không cần phải khởi động lại (Zero-Downtime)."*

### Kịch bản 3: AI Agent & Human-in-the-loop (ĐIỂM NHẤN QUAN TRỌNG NHẤT) 🔥
- **Hành động:** Mở Swagger UI của Backend (`/docs`) hoặc gọi thẳng API `POST /api/v1/ai/command` với body JSON (có `effect="write"`).
- **Hành động:** Dùng API hoặc Widget Chat giả lập yêu cầu: *"Duyệt 3 ngày nghỉ phép cho nhân viên Nguyễn Văn A"*.
- **Hành động:** Chuyển sang Tab Mattermost. Sẽ thấy một Interactive Message từ Bot với nút **[Phê duyệt]** / **[Từ chối]**.
- **Hành động:** Bấm **[Phê duyệt]**. Quay lại màn hình Terminal Backend/Log, thấy sự kiện callback đã kích hoạt hành động và ghi Audit Log.
- **Thuyết minh:** *"Đây là thiết kế cốt lõi của hệ thống AI: 'Rule Sinh Tử'. AI có quyền truy cập dữ liệu nhưng với các thao tác nhạy cảm (ghi/xóa), nó bắt buộc phải trình qua hệ thống Chat (Mattermost) để Ban Giám đốc bấm xác nhận. Việc này giải quyết bài toán rủi ro lớn nhất khi giao quyền cho AI trong doanh nghiệp: Sự mất kiểm soát."*

### Kịch bản 4: Tích hợp hệ sinh thái Low-code (Dashboard / Workflow)
- **Hành động:** Mở một màn hình Báo cáo (Metabase được nhúng qua iframe).
- **Thuyết minh:** *"Thay vì code tay lại các biểu đồ phức tạp từ đầu, Proteus OS nhúng trực tiếp sức mạnh của các hệ thống Open-Source hàng đầu thế giới (Metabase cho BI, n8n cho Workflow, Appsmith cho UI) vào chung một giao diện (App Shell) duy nhất thông qua kiến trúc BFF (Backend for Frontend)."*

---

## 4. Phần 3: Trả lời Câu hỏi Thường Gặp (Q&A)

Chuẩn bị sẵn câu trả lời sắc bén:
1. **Dữ liệu nhiều công ty (Tenant) lưu chung 1 Database thì sao bảo mật được?**
   > *Trả lời:* Dự án áp dụng Postgres Row-Level Security (RLS) ở mức DB. Cột `tenant_id` được tự động tiêm từ JWT Token. Cho dù có lỗi ở tầng ứng dụng (code bug, ORM leak), thì Database Engine cũng từ chối trả về dữ liệu của Tenant khác.

2. **Tại sao không tự code ứng dụng Chat và biểu đồ mà phải dùng Mattermost/Metabase?**
   > *Trả lời:* Hệ thống tuân theo triết lý "Không phát minh lại bánh xe" (Don't reinvent the wheel). Việc tận dụng các giải pháp Open-source mạnh nhất giúp hệ thống dễ dàng mở rộng lên chuẩn Enterprise ngay từ phiên bản đầu tiên, đồng thời tập trung nguồn lực phát triển lớp màng thông minh (AI Orchestrator) thay vì code lại các tính năng UI tốn thời gian.

3. **Làm sao đảm bảo tính độc lập của các Plugin?**
   > *Trả lời:* Mỗi Plugin được đóng gói kèm một `manifest.yaml` và các DSL (Domain-Specific Language) schemas. Backend sẽ cấp một `task_id` riêng biệt, chạy trong các Async Tasks, tự động tạo Table và RLS Policies độc lập cho Plugin đó, không trộn lẫn vào lõi.
