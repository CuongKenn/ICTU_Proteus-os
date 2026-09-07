# Báo cáo Đánh giá Tiêu chí Nguồn mở (PoF Compliance Report)

**Cuộc thi:** Phát triển phần mềm mã nguồn mở tích hợp AI 2026  
**Đơn vị tổ chức:** Khoa Công nghệ Thông tin — Trường ĐH Công nghệ Thông tin & Truyền thông (ICTU) - Đại học Thái Nguyên  
**Dự án dự thi:** Proteus OS (Universal Operating System for Organizations)  
**Tác giả / Đội thi:** CuongKenn & ICTU Team  
**Kho mã nguồn:** [https://github.com/CuongKenn/ICTU_Proteus-os](https://github.com/CuongKenn/ICTU_Proteus-os)

---

## TỔNG KẾT ĐIỂM TỰ ĐÁNH GIÁ: 50 / 50 ĐIỂM (PHẦN I - TIÊU CHÍ DỰA TRÊN PoF)

| TT | Tiêu chí đánh giá | Điểm tối đa | Điểm tự chấm | Tình trạng đáp ứng | Minh chứng chi tiết |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | **Sử dụng hệ thống quản lý mã nguồn trên Internet** | **5** | **5 / 5** | ✅ Đáp ứng 100% | Kho GitHub công khai, web viewer, lịch sử commit liên tục |
| **2** | **Cấp phép PMMN theo giấy phép OSI-approved** | **10** | **10 / 10** | ✅ Đáp ứng 100% | Giấy phép GNU AGPLv3, bản sao toàn văn, ghi header 100% file mã nguồn |
| **3** | **Có ít nhất một bản phát hành (release) để làm sản phẩm dự thi** | **5** | **5 / 5** | ✅ Đáp ứng 100% | 3 bản phát hành v1.0.0, v1.0.1, v1.0.2 với định dạng mở `.tar.gz` |
| **4** | **Cài đặt, dịch từ mã nguồn (Building From Source)** | **10** | **10 / 10** | ✅ Đáp ứng 100% | Có `BUILDING.md`, cấu hình qua `.env` không sửa header, 100% công cụ mở |
| **5** | **Sử dụng thư viện và gói đính kèm (bundling)** | **10** | **10 / 10** | ✅ Đáp ứng 100% | Có `DEPENDENCIES.md`, chính sách Zero-Bundling, không sửa đổi mã nguồn thư viện |
| **6** | **Tài liệu và giao tiếp** | **10** | **10 / 10** | ✅ Đáp ứng 100% | Có Bug Tracker (Issues), `CHANGELOG.md` chuẩn hóa, `README.md` chi tiết |
| **TỔNG** | **ĐIỂM TIÊU CHÍ PoF** | **50** | **50 / 50** | **HOÀN TOÀN KHÔNG BỊ TRỪ ĐIỂM NÀO** | |

---

## CHI TIẾT ĐỐI CHIẾU TỪNG TIÊU CHÍ VÀ CÁC ĐIỂM TRỪ TRONG THỂ LỆ

### Tiêu chí 1: Sử dụng hệ thống quản lý mã nguồn trên Internet (5 điểm)

- **Yêu cầu:** Có thể truy cập kho mã nguồn của sản phẩm từ Internet.
- **Rà soát các lỗi bị trừ điểm:**
  - *Có hệ thống QLMN công khai nhưng không có web viewer (-3 điểm):* ❌ **Không bị trừ.** Kho mã nguồn sử dụng GitHub có đầy đủ giao diện web trực quan, duyệt code, diff, blame.
  - *Có hệ thống QLMN nhưng không được truy cập mở (-3 điểm):* ❌ **Không bị trừ.** Repo hoàn toàn **Public**, bất kỳ ai cũng có thể `clone` hoặc xem trực tiếp mà không cần đăng nhập.
  - *Có hệ thống QLMN nhưng trên thực tế không được sử dụng (-5 điểm):* ❌ **Không bị trừ.** Repo có hơn 500+ commits, 300+ Pull Requests, 310+ Issues được thảo luận và đóng liên tục theo tiến trình phát triển.
- **Minh chứng:** [https://github.com/CuongKenn/ICTU_Proteus-os](https://github.com/CuongKenn/ICTU_Proteus-os)

---

### Tiêu chí 2: Cấp phép PMMN theo giấy phép OSI-approved (10 điểm)

- **Yêu cầu:** Sản phẩm có giấy phép mở được OSI phê chuẩn và giải quyết đúng đầu bài của đề thi.
  - Dự án sử dụng **GNU Affero General Public License Version 3 (GNU AGPLv3)** — giấy phép nguồn mở chính thức được OSI công nhận ([OSI Approved Licenses](https://opensource.org/licenses/AGPL-3.0)).
- **Rà soát các lỗi bị trừ điểm:**
  - *Giấy phép không được ghi trong từng tệp mã (-5 điểm):* ❌ **Không bị trừ.** 100% tệp mã nguồn (Python, TypeScript, TSX, Shell, PowerShell, SQL) đều có comment chuẩn SPDX ở đầu file:
    ```text
    Copyright (c) 2026 CuongKenn & ICTU Team
    SPDX-License-Identifier: AGPL-3.0-or-later
    ```
  - *Mã nguồn tự thân chứa sự không tương thích của các giấy phép (-5 điểm):* ❌ **Không bị trừ.** Tất cả các thư viện liên kết đều dùng giấy phép tương thích hoàn hảo với AGPLv3 (MIT, Apache 2.0, BSD-3-Clause, PostgreSQL License).
  - *Mã nguồn không có thông báo về mục đích của giấy phép (-5 điểm):* ❌ **Không bị trừ.** Đã công bố tài liệu [docs/LICENSE_NOTICE.md](./LICENSE_NOTICE.md) nêu rõ mục đích chọn AGPLv3 nhằm bảo vệ quyền tự do trên môi trường SaaS/Cloud Service và ma trận tương thích giấy phép.
  - *Mã nguồn không bao gồm một bản sao toàn văn giấy phép (-5 điểm):* ❌ **Không bị trừ.** Tệp [LICENSE](../LICENSE) tại thư mục gốc chứa nguyên bản toàn văn 662 dòng của GNU AGPLv3 do Free Software Foundation ban hành.
- **Minh chứng:** [LICENSE](../LICENSE), [docs/LICENSE_NOTICE.md](./LICENSE_NOTICE.md)

---

### Tiêu chí 3: Có ít nhất một bản phát hành (release) để làm sản phẩm dự thi (5 điểm)

- **Yêu cầu:** Có ít nhất một bản phát hành trước thời điểm nộp bài thi.
- **Rà soát các lỗi bị trừ điểm:**
  - *Dự án không có phát hành (-5 điểm):* ❌ **Không bị trừ.** Dự án đã phát hành các phiên bản chính thức trên GitHub Releases.
  - *Dự án không thực hiện phát hành theo phiên bản (-3 điểm):* ❌ **Không bị trừ.** Áp dụng chuẩn Đánh số phiên bản ngữ nghĩa (Semantic Versioning 2.0.0): `v1.0.0`, `v1.0.1`, `v1.0.2`.
  - *Sử dụng các định dạng không phải là mở cho bản phát hành (-3 điểm):* ❌ **Không bị trừ.** Dự án cung cấp định dạng nén mở chuẩn POSIX là **`.tar.gz` (Tar Gzip)** cho mã nguồn phát hành:
    - Link tải trực tiếp định dạng mở: [v1.0.2 Source Code (.tar.gz)](https://github.com/CuongKenn/ICTU_Proteus-os/archive/refs/tags/v1.0.2.tar.gz)
- **Minh chứng:** [GitHub Releases](https://github.com/CuongKenn/ICTU_Proteus-os/releases)

---

### Tiêu chí 4: Cài đặt, dịch từ mã nguồn (Building From Source) (10 điểm)

- **Yêu cầu:** Sản phẩm phải cho phép cài đặt, biên dịch được từ mã nguồn.
- **Rà soát các lỗi bị trừ điểm:**
  - *Không có hướng dẫn dịch từ mã nguồn (-5 điểm):* ❌ **Không bị trừ.** Đã biên soạn tài liệu toàn diện [BUILDING.md](../BUILDING.md) hướng dẫn từng bước biên dịch cả chế độ Docker và Bare-Metal.
  - *Mã nguồn được cấu hình bằng cách sửa thủ công vào các tệp header (-5 điểm):* ❌ **Không bị trừ.** Mọi tham số cấu hình đều được tách rời thành biến môi trường (`.env`), không yêu cầu sửa đổi bất kỳ tệp header hoặc mã nguồn nào.
  - *Mã nguồn không cấu hình được trước khi dịch (-5 điểm):* ❌ **Không bị trừ.** Cho phép sao chép `.env.example` thành `.env` để tùy biến toàn bộ port, domain, credentials trước khi chạy lệnh build.
  - *Mã nguồn được dịch bằng công cụ nguồn đóng hoặc tự tạo (-5 điểm):* ❌ **Không bị trừ.** 100% công cụ dịch là phần mềm nguồn mở tiêu chuẩn: CPython 3.12 (PSF), Node.js (MIT), npm, Docker Community Edition (Apache 2.0).
  - *Chương trình không thể hoạt động nếu nằm ngoài thư mục mã nguồn (-5 điểm):* ❌ **Không bị trừ.** Ứng dụng được đóng gói thành Docker Image độc lập hoặc Next.js Standalone, có thể triển khai ở bất kỳ thư mục/máy chủ nào.
- **Minh chứng:** [BUILDING.md](../BUILDING.md)

---

### Tiêu chí 5: Sử dụng thư viện và gói đính kèm (bundling) (10 điểm)

- **Yêu cầu:** Có thông tin làm rõ các thư viện, gói đính kèm được sử dụng.
- **Rà soát các lỗi bị trừ điểm:**
  - *Không cố gắng sử dụng các thư viện sẵn có trong hệ thống (-5 điểm):* ❌ **Không bị trừ.** Dự án kế thừa tối đa các nền tảng nguồn mở sẵn có hàng đầu thế giới (Keycloak, n8n, Appsmith, Metabase, Mattermost, PostgreSQL, Redis, Qdrant, Traefik).
  - *Phát hành cùng với gói đính kèm của các dự án khác mà nó phụ thuộc vào (-5 điểm):* ❌ **Không bị trừ.** Áp dụng chính sách **Zero Bundling** — không commit mã nguồn của thư viện bên thứ 3 vào git, mà quản lý phụ thuộc thông qua `requirements.txt` và `package.json`.
  - *Mã nguồn của gói đính kèm đã bị chỉnh sửa (-5 điểm):* ❌ **Không bị trừ.** Toàn bộ thư viện được cài đặt nguyên bản từ PyPI và npmjs chính thức, không can thiệp hay vá mã nguồn nội bộ thư viện.
- **Minh chứng:** [DEPENDENCIES.md](../DEPENDENCIES.md)

---

### Tiêu chí 6: Tài liệu và giao tiếp (10 điểm)

- **Yêu cầu:** Tài liệu rõ ràng, thực hiện được.
- **Rà soát các lỗi bị trừ điểm:**
  - *Không có ghi nhận quản lý lỗi phần mềm (bug tracker) (-5 điểm):* ❌ **Không bị trừ.** Sử dụng hệ thống **GitHub Issues** công khai với Issue Templates chuẩn hóa cho `Bug Report` và `Feature Request`.
  - *Không có lịch sử thay đổi mã nguồn (changelog) (-5 điểm):* ❌ **Không bị trừ.** Duy trì tệp [CHANGELOG.md](../CHANGELOG.md) cập nhật liên tục theo chuẩn quốc tế [Keep a Changelog](https://keepachangelog.com/) và Semantic Versioning.
  - *Không có tài liệu readme và hướng dẫn (-5 điểm):* ❌ **Không bị trừ.** Tệp [README.md](../README.md) đầy đủ thông tin giới thiệu, kiến trúc, hướng dẫn cài đặt nhanh, liên kết tài liệu đặc tả và hướng dẫn đóng góp [CONTRIBUTING.md](../CONTRIBUTING.md).
- **Minh chứng:** [README.md](../README.md), [CHANGELOG.md](../CHANGELOG.md), [GitHub Issues](https://github.com/CuongKenn/ICTU_Proteus-os/issues), [.github/ISSUE_TEMPLATE](../.github/ISSUE_TEMPLATE/)
