---
name: PR Deep Review
description: Review Pull Request chuyên sâu qua 10 vòng kiểm tra (Tích hợp CI Check, Auto-context, Backward Compatibility & Github Action)
---

# PR Deep Review Workflow (/pr-deep-review)

Workflow này hướng dẫn AI đóng vai trò là một Staff/Principal Engineer để thực hiện review Pull Request cực kỳ khắt khe, kết hợp tự động hóa, context-aware và phân tích sâu, đảm bảo code đạt tiêu chuẩn production.

## Cách sử dụng
Sử dụng slash command sau trên chat:
`/pr-deep-review <pr_number_or_url>` 
(Ví dụ: `/pr-deep-review 235`)

## Các bước thực hiện
Khi nhận được yêu cầu review, AI BẮT BUỘC phải thực hiện tuần tự các bước sau:

### Giai đoạn 1: Chuẩn bị & Fail-Fast (Pre-check & Context)
1. **Kiểm tra trạng thái CI/CD:** Chạy lệnh `gh pr checks <pr_number>`. Nếu CI đang failed, DỪNG REVIEW logic sâu ngay lập tức. Hãy gọi lệnh `gh pr review --comment` báo cho dev fix các lỗi build/test cơ bản trước.
2. **Auto-discovery Context:** Tự động tìm và đọc các file cấu hình (`AGENTS.md`, `openapi.yaml`, `docs/`) để nạp quy tắc dự án.
3. **Thu thập dữ liệu & Phân loại Label:** Đọc diff của PR (`gh pr view`, `gh pr diff`). Lấy danh sách Label của PR để quyết định trọng tâm (VD: label `frontend` thì tập trung UI/State, `database` thì tập trung Migration/Locking).
4. **Chiến lược Chunking (Cho PR lớn):** Nếu PR có >15 files, AI PHẢI chia nhỏ thành nhiều đợt review theo module/domain để tránh ảo giác (hallucination).
5. **Thông báo trạng thái:** Dùng `gh pr comment` nhắn: *"🤖 AI đang tiến hành Deep Review (10 vòng) cho PR này. Quá trình có thể mất vài phút..."*

### Giai đoạn 2: Tiến hành 10 Vòng Review Nội Bộ (10-Round Deep Scan)
Sử dụng tư duy tuần tự (sequential thinking) để soi xét PR qua 10 khía cạnh:

- **Vòng 1 - Metadata & Issue Link:** PR đã link Issue chưa? Tên commit/PR chuẩn semantic không?
- **Vòng 2 - Documentation & Changelog:** Có khớp hoàn toàn với tài liệu hệ thống (openapi, ERD) không? BẮT BUỘC kiểm tra xem tác giả đã cập nhật `CHANGELOG.md` cho các thay đổi mới chưa.
- **Vòng 3 - Open Source Rules & Architecture:** Code có phá vỡ cấu trúc (Hexagonal, MVC) và tuân thủ `AGENTS.md` không? Các file code mới tạo BẮT BUỘC phải có thông tin Copyright & License (VD: GNU AGPLv3) ở các dòng đầu tiên.
- **Vòng 4 - SOLID & Design Patterns:** Có vi phạm SRP, OCP, LSP, ISP, DIP không? Tight coupling?
- **Vòng 5 - Logical Correctness & Edge Cases:** Luồng chính chạy đúng không? Đã bẫy lỗi triệt để chưa?
- **Vòng 6 - Performance & Scalability:** Có vòng lặp thừa, N+1 Query trong DB, memory leak? Pagination?
- **Vòng 7 - Security & Auth:** Sanitize input? SQLi, XSS, phân quyền chặt chẽ?
- **Vòng 8 - Backward Compatibility (Quan Trọng Nhất):** Có vô tình làm sập client cũ, API đang dùng không?
- **Vòng 9 - Best Practices & Clean Code:** Hardcode? Logging chuẩn không? Tên biến dễ hiểu?
- **Vòng 10 - Testing & Coverage:** Có Unit/Integration test kèm theo không?

### Giai đoạn 3: Tự kiểm duyệt (Sanity & Meta-Review)
Trước khi xuất báo cáo, AI PHẢI tự rà soát:
- Lỗi phát hiện **có thực sự nằm trong dòng code mới/thay đổi (+/-)** không? TUYỆT ĐỐI CẤM bắt lỗi những đoạn code cũ (unchanged lines) mà PR không động tới.
- Mọi review phải có dẫn chứng cụ thể bằng code snippet.

### Giai đoạn 4: Tổng hợp & Hành động (Action)
BẮT BUỘC dùng `gh cli` qua `run_command` để submit trực tiếp lên Github. KHÔNG output dài dòng ra chat.
Trong file `pr_review_msg.txt`, bắt buộc format rõ: `File: ... | Line: ...` kèm đề xuất sửa code.

- ❌ **REQUEST CHANGES (Nếu lỗi logic sai, kiến trúc vi phạm nghiêm trọng):**
  - Chạy lệnh: `gh pr review <pr_number> --request-changes --body-file pr_review_msg.txt`

- 💬 **COMMENT (Code không sai, nhưng cần làm rõ thiết kế hoặc nhắc nhở nhẹ):**
  - Chạy lệnh: `gh pr review <pr_number> --comment --body-file pr_review_msg.txt`

- ✅ **APPROVE (Nếu code hoàn hảo):**
  - Chạy lệnh: `gh pr review <pr_number> --approve --body "LGTM! Code chuẩn chỉ, đã pass 10 vòng deep review."`

Sau khi submit xong bằng terminal, báo cáo ngắn gọn 1 câu vào chat của user.

## Tiêu chí tối thượng (Core Directives)
- Review với tâm thế của một Tech Lead khó tính: KHÔNG NHƯỢNG BỘ trước code smell hay convention sai lệch.
- Đặt tính Ổn định (Stability), Tương thích ngược (Backward Compatibility) và Bảo mật (Security) lên hàng đầu.
- **Tuân thủ tiêu chuẩn Open Source:** Tuyệt đối không châm chước việc thiếu cập nhật `CHANGELOG.md` hoặc thiếu header Copyright/License trong các file mã nguồn.
