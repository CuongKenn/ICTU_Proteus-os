# Ý tưởng Thiết kế Giao diện (UI/UX) cho Proteus OS

Để Proteus OS thực sự mang tầm vóc của một "Hệ điều hành Đa năng cho mọi tổ chức" chứ không chỉ là một phần mềm quản lý thông thường, giao diện người dùng (UI) cần được thiết kế theo hướng **Hiện đại, Tối giản và Tập trung vào trải nghiệm (User-centric)**. 

Dưới đây là mô tả chi tiết và hình ảnh phác thảo (Mockup) cho 2 màn hình quan trọng nhất của hệ thống.

---

## 1. Màn hình Chính (Proteus OS Launchpad)

Thay vì thiết kế theo dạng thanh menu dọc (Sidebar) nhàm chán như các ERP truyền thống, Proteus OS sẽ sử dụng giao diện **Launchpad** (tương tự như màn hình chính của iPad hay macOS).

> [!TIP]
> **Điểm nhấn thiết kế:**
> - **Glassmorphism:** Các icon và panel được thiết kế với hiệu ứng kính mờ (kết hợp CSS `backdrop-filter: blur`), tạo cảm giác không gian đa chiều.
> - **Dark Mode Native:** Tông màu chủ đạo là xanh đen tối bản (Deep Blue/Purple), giúp nhân viên làm việc cả ngày không bị mỏi mắt, đồng thời toát lên vẻ cao cấp "Premium".
> - **Trợ lý AI Thường trực:** Một Widget AI luôn nổi (Floating) ở góc phải màn hình. Giám đốc có thể chat trực tiếp để ra lệnh (Ví dụ: *"Duyệt cho tôi tất cả đơn nghỉ phép hôm nay"*).

![Proteus OS Launchpad Concept](./images/proteus_os_launchpad.png)

---

## 2. Chợ Ứng dụng Nội bộ (Plugin Marketplace)

Đây là nơi Ban Giám đốc hoặc Admin IT truy cập để mở rộng tính năng cho công ty. Màn hình này nằm trong lõi **Innovation Layer** mà đội thi tự code bằng Next.js.

> [!NOTE]
> **Trải nghiệm thao tác (UX):**
> Khi Admin bấm nút **[INSTALL]** ở một thẻ (Card) như *HR Core Pro*, một thanh tiến trình (Progress Bar) sẽ chạy. Phía dưới (Backend), hệ thống đang tự động tải file `manifest.yaml`, đẩy data vào PostgreSQL và gọi n8n tạo Workflow. Sau 30s, cài đặt hoàn tất mà không cần chuyển trang.

![Proteus OS Marketplace Concept](./images/proteus_os_marketplace.png)

---

## 3. Các thành phần UI bên trong Ứng dụng (App UI)

Khi người dùng click vào một Icon trên Launchpad (VD: click vào *Finance*), hệ thống sẽ mở ứng dụng đó ra. Tuy nhiên, để đảm bảo tính đồng nhất (Consistency) về trải nghiệm:

1. **Khung viền chung (App Shell):** Mọi ứng dụng (dù là Appsmith tự thiết kế hay Metabase nhúng vào) đều được bọc trong một khung viền Iframe nội bộ có chứa thanh điều hướng trên cùng (Top Navbar). *(Lưu ý: Để tránh lỗi bảo mật chặn hiển thị Iframe của trình duyệt, toàn bộ các ứng dụng được định tuyến qua Traefik chia sẻ chung một domain gốc bằng phương pháp Single-Domain Path-Based Routing, vd: `proteus.local/chat`, `proteus.local/apps`).*
2. **Nút "Về trang chủ" (Home Button):** Luôn có một nút logo Proteus OS ở góc trên cùng bên trái để nhân viên thoát ứng dụng hiện tại và quay lại màn hình Launchpad một cách mượt mà nhất.
3. **Single Sign-On (Trải nghiệm liền mạch):** Nhờ Keycloak, người dùng khi bấm vào icon Chat (Mattermost) hay Wiki (Outline) sẽ vào thẳng bên trong luôn mà không bao giờ bị hỏi lại mật khẩu.
4. **Trung tâm thông báo (Notification Center):** Tích hợp một "Quả chuông" ở Top Navbar để tổng hợp mọi cảnh báo từ Mattermost, hệ thống duyệt đơn n8n, và Tác tử AI giám sát, giúp người dùng không bỏ lỡ thông tin quan trọng.

---

## 4. Trải nghiệm Đa nền tảng và Trợ năng (Accessibility)

- **Thiết kế Đáp ứng (Mobile Responsiveness):** Cấu trúc lưới (Grid) của Launchpad và giao diện Appsmith/Metabase đều được thiết kế Responsive 100%, đảm bảo Giám đốc có thể xem báo cáo hoặc duyệt đơn trơn tru ngay trên màn hình điện thoại di động (Smartphone/Tablet).
- **Chế độ Sáng/Tối (Light/Dark Mode Toggle):** Dù Dark Mode mang lại vẻ cao cấp, hệ thống vẫn cung cấp nút chuyển đổi sang Light Mode (chế độ nền trắng, chữ đen) để phục vụ cho các nhân sự lớn tuổi hoặc khi làm việc dưới môi trường chói sáng, đáp ứng tiêu chuẩn tiếp cận (a11y) của phần mềm quản trị chuyên nghiệp.
