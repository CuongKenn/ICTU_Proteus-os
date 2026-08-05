# Hướng dẫn Đóng góp (Contributing Guide)

Chào mừng bạn đến với **Proteus OS**! Chúng tôi rất vui vì bạn quan tâm và muốn đóng góp cho dự án. 

Để quá trình làm việc nhóm diễn ra trơn tru, vui lòng đọc kỹ các quy tắc dưới đây trước khi gửi Pull Request (PR).

## 1. Triết lý Thiết kế
Trước khi code, hãy chắc chắn bạn đã đọc qua hệ thống tài liệu trong thư mục `docs/`:
- **BRD.md**: Nắm rõ tầm nhìn và phạm vi của dự án.
- **architecture.md**: Hiểu rõ về kiến trúc Micro-Kernel và Hexagonal.

## 2. Quy trình Đóng góp
1. **Fork repository** về tài khoản cá nhân của bạn.
2. **Clone** repo đã fork về máy.
3. Tạo một **branch mới** từ nhánh `main`. Tên branch nên tuân thủ quy tắc:
   - `feature/tên-tính-năng`
   - `bugfix/mô-tả-lỗi`
   - `docs/tên-tài-liệu`
4. Commit code. Vui lòng viết thông điệp commit rõ ràng, tuân thủ theo [Conventional Commits](https://www.conventionalcommits.org/).
5. Push branch lên repo đã fork của bạn.
6. Tạo một **Pull Request (PR)** từ branch của bạn vào nhánh `main` của repo gốc.

## 3. Tiêu chuẩn Mã nguồn (Coding Standards)
- **Frontend (Next.js):** Sử dụng ESLint và Prettier. Không dùng MVVM, hãy sử dụng Custom Hooks và Zustand cho State Management.
- **Backend (FastAPI):** Tuân thủ PEP 8 (sử dụng Black hoặc Flake8). Đảm bảo mọi API Endpoint mới đều có khai báo Pydantic Schema để tự sinh tài liệu Swagger.
- **Kiểm thử (Testing):** Khuyến khích viết Unit Test cho mọi chức năng cốt lõi (Innovation Layer).

## 4. Báo cáo Lỗi (Issue Reporting)
Nếu bạn phát hiện lỗi, hãy tạo một Issue mới trên GitHub. Đảm bảo mô tả rõ:
- Các bước để tái tạo lỗi (Steps to reproduce).
- Kết quả mong muốn (Expected behavior).
- Kết quả thực tế (Actual behavior).

Cảm ơn bạn đã đóng góp!
