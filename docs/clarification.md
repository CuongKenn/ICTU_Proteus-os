> [!NOTE]
> **Lưu ý quan trọng:** Tài liệu này được biên soạn dành riêng cho **NGƯỜI ĐỌC** (Ban giám khảo, Lập trình viên, Quản trị dự án, Chuyên gia phân tích hệ thống) để hiểu rõ triết lý thiết kế và các quyết định kiến trúc cốt lõi. Tài liệu này **KHÔNG PHẢI** là chỉ thị (prompt/instructions) dành cho các Tác tử AI (AI Agents). Vui lòng không nạp nguyên văn file này vào bộ nhớ của Agent.

# Làm rõ Kiến trúc: Đa khách hàng (Multi-Tenancy), Phân quyền (RBAC) và Giao diện Động

Tài liệu này đi sâu vào cách hệ thống Proteus OS giải quyết ba bài toán hóc búa nhất của một phần mềm SaaS (Software as a Service) quy mô lớn dành cho khối Doanh nghiệp và Giáo dục (B2B/B2B2C).

---

## 1. Cơ chế Quản lý Danh tính & Phân quyền (RBAC) với Keycloak

Proteus OS áp dụng triết lý "Identity-First Security". Thay vì tự code chức năng Đăng nhập/Đăng ký tiềm ẩn nhiều lỗ hổng, chúng ta sử dụng **Keycloak** làm Hệ thống Cung cấp Danh tính (Identity Provider - IdP).

### 1.1. Khai báo Vai trò (Role Definition)
Mọi phân hệ nghiệp vụ (Plugin) khi được phát triển đều phải định nghĩa các quyền hạn cụ thể trong file `manifest.yaml`. 
- **Ví dụ:** Trong hệ thống Trường học, Plugin "Sổ đầu bài" sẽ khai báo các Roles: `GiaoVien`, `HocSinh`, `GiamThi`.
- Khi Plugin được cài đặt qua App Store, hệ thống `core-engine` sẽ tự động gọi API của Keycloak để tạo các Roles này nếu chưa tồn tại.

### 1.2. Luồng Ủy quyền (Authorization Flow)
1. **Đăng nhập (SSO):** Người dùng truy cập Launchpad, hệ thống điều hướng sang Keycloak. Keycloak xác thực xong sẽ trả về một **JWT (JSON Web Token)** chứa thông tin user và danh sách các Roles của họ.
2. **Kiểm duyệt tại cổng (API Gateway):** Khi Frontend gọi API lấy dữ liệu, JWT này được đính kèm vào Header (`Authorization: Bearer <token>`).
3. **Thực thi (Resource Server):** FastAPI ở Backend sẽ giải mã JWT. Nếu phát hiện User không có Role `GiaoVien`, API lập tức trả về mã lỗi `403 Forbidden`. Luồng xử lý kết thúc ngay tại lớp mạng, bảo vệ cơ sở dữ liệu khỏi các truy vấn trái phép.

---

## 2. Giao diện (UI) Thích ứng Động (Dynamic UI/UX)

Để tránh tình trạng người dùng bị "ngợp" trước hàng chục tính năng mà họ không được phép dùng, giao diện của Proteus OS được thiết kế theo nguyên tắc **Tối giản hóa dựa trên ngữ cảnh (Contextual UI)**.

### 2.1. Màn hình Chính (Proteus OS Launchpad)
Launchpad được xây dựng bằng Next.js. Quá trình render danh sách ứng dụng được xử lý như sau:
- Token của người dùng được phân tích ngay tại Server-Side (Next.js SSR) hoặc qua React Context (CSR).
- Hệ thống so khớp (Map) danh sách Roles của user với danh sách yêu cầu quyền của từng Plugin.
- **Kết quả:** Một Kế toán viên sẽ chỉ nhìn thấy biểu tượng *Finance Module* và *Chat*. Họ hoàn toàn không biết đến sự tồn tại của biểu tượng *HR Module* hay *IT Admin*. Điều này giúp UI cực kỳ sạch sẽ và giảm thiểu rủi ro bấm nhầm.

### 2.2. Xuyên suốt các ứng dụng (Seamless SSO)
- **Đối với Appsmith (Low-code):** Appsmith hỗ trợ ánh xạ (OIDC Role Mapping). Khi quản lý mở một Form nhập liệu, Appsmith nhận diện họ là `Manager` và tự động hiển thị tab "Duyệt yêu cầu". Nhân viên thường sẽ bị ẩn tab này ở cấp độ Frontend, và nếu cố tình dùng Postman để gọi API duyệt đơn, Backend cũng sẽ chặn lại (Phòng vệ chiều sâu).
- **Đối với Metabase (BI Dashboard):** Proteus OS cấu hình Metabase với Data Sandboxing. Khi Giáo viên chủ nhiệm đăng nhập, JWT sẽ báo cho Metabase biết ID của giáo viên đó. Kết quả: Biểu đồ sẽ tự động filter để **chỉ hiển thị điểm số của lớp đó quản lý**, ngăn ngừa triệt để việc rò rỉ thông tin toàn trường.

---

## 3. Kiến trúc Đa Khách Hàng (Multi-Tenancy) cho mô hình SaaS

Khi cung cấp Proteus OS cho hàng trăm Trường học hoặc Doanh nghiệp, chúng ta không thể cài đặt hàng trăm server vật lý riêng lẻ (gây tốn kém cực lớn). Hệ thống sử dụng mô hình Multi-Tenancy tiên tiến.

### 3.1. Cô lập Tài khoản ở cấp độ Realm (Keycloak)
- Keycloak hỗ trợ khái niệm **Realms**. Mỗi khách hàng (Ví dụ: `Truong_Chu_Van_An`, `Truong_Ams`) sẽ là một Realm hoàn toàn tách biệt.
- Cơ sở dữ liệu user, chính sách mật khẩu (độ dài mật khẩu, bắt buộc 2FA) của trường này không liên quan gì đến trường kia. User `admin` của Trường A không thể đăng nhập vào đường dẫn của Trường B.

### 3.2. Cô lập Dữ liệu (Database Data Isolation)
Thay vì cấp cho mỗi trường một Database vật lý riêng, Proteus OS sử dụng sự kết hợp giữa hai phương pháp nhằm tối ưu chi phí hạ tầng (Cloud Cost):
1. **Schema-per-tenant:** Bên trong 1 Database PostgreSQL duy nhất, mỗi trường học sẽ có một "Schema" riêng (VD: schema `truong_cva`, `truong_ams`). Dữ liệu được cách ly ở mức logic. Cách này đảm bảo an toàn rất cao và dễ dàng sao lưu (Backup) riêng lẻ cho từng trường.
2. **Row-Level Security (RLS):** Đối với các bảng dữ liệu dùng chung (như danh sách Tỉnh/Thành, danh mục cấu hình hệ thống toàn cục), PostgreSQL áp dụng RLS. Bất kỳ câu truy vấn (`SELECT`, `UPDATE`) nào gọi từ FastAPI cũng bắt buộc phải truyền biến `tenant_id` lấy từ Token. DB sẽ tự động từ chối trả về hoặc sửa đổi các dòng dữ liệu không thuộc `tenant_id` đó.

### 3.3. Cô lập Cài đặt Plugin (App Store)
Giao diện Chợ Ứng Dụng (Marketplace) cũng hoàn toàn độc lập cho từng tổ chức.
- **Trường A** ký hợp đồng mua gói "Quản lý Canteen", hệ thống sẽ kích hoạt (Active) và chạy file `seed_data.sql` của Plugin này vào đúng Schema của Trường A.
- **Trường B** khi đăng nhập vào hệ thống của họ sẽ không hề biết đến sự tồn tại của bảng dữ liệu Canteen này.
- **Cập nhật hệ thống:** Khi nâng cấp phiên bản Plugin, Quản trị viên hệ thống (Super Admin) có thể chọn cập nhật cho tất cả Tenant, hoặc chỉ thử nghiệm (A/B Testing) bản cập nhật trên một Tenant duy nhất trước khi phát hành diện rộng.
