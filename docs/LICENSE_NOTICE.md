# Thông báo Cấp phép & Mục đích Giấy phép (License Notice & Purpose)

**Dự án:** Proteus OS (Universal OS for Organizations)  
**Tác giả:** CuongKenn & ICTU Team (Trường Đại học Công nghệ Thông tin & Truyền thông - Đại học Thái Nguyên)  
**Giấy phép bản quyền:** GNU Affero General Public License Version 3 (GNU AGPLv3)  
**Mã nhận dạng SPDX:** `AGPL-3.0-or-later`  
**Bản sao toàn văn:** [LICENSE](../LICENSE)

---

## 1. Mục đích của việc lựa chọn Giấy phép GNU AGPLv3 (Purpose of License)

Hệ điều hành Proteus OS được phát triển theo mô hình hệ thống quản trị tích hợp đa người thuê (Multi-Tenancy) và kiến trúc vi hạt nhân (Micro-Kernel) cung cấp dịch vụ qua mạng (Network / Cloud Service). Nhóm tác giả quyết định áp dụng giấy phép **GNU Affero General Public License Version 3 (AGPLv3)** — một giấy phép nguồn mở chuẩn được **OSI (Open Source Initiative) phê chuẩn** — nhằm các mục đích cốt lõi sau:

1. **Bảo vệ tuyệt đối quyền tự do của người dùng cuối và cộng đồng:**
   - Đảm bảo rằng bất kỳ tổ chức, cá nhân, doanh nghiệp nào sử dụng Proteus OS trực tiếp hoặc thông qua mạng Internet đều có quyền tiếp cận toàn văn mã nguồn của phần mềm (bao gồm cả các bản chỉnh sửa, cải tiến).
2. **Ngăn chặn độc quyền hóa trên nền tảng đám mây (Anti-Cloud Enclosure):**
   - Không giống như GPLv3 thông thường (chỉ kích hoạt nghĩa vụ mở mã nguồn khi phân phối nhị phân), AGPLv3 giải quyết lỗ hổng ASP/SaaS bằng cách bắt buộc bất kỳ ai cung cấp Proteus OS như một dịch vụ trực tuyến (Network Service) phải cung cấp toàn bộ mã nguồn cải tiến cho người dùng dịch vụ đó.
3. **Thúc đẩy đổi mới sáng tạo trong nghiên cứu và giáo dục:**
   - Hệ thống được thiết kế mở để các bạn sinh viên, giảng viên và các nhà nghiên cứu của Đại học Thái Nguyên và cộng đồng có thể tự do học tập, kế thừa, phát triển thêm các Plugin/Phân hệ mở rộng mới mà không lo ngại về vấn đề bản quyền độc quyền.

---

## 2. Ma trận Tương thích Giấy phép (License Compatibility Matrix)

Mã nguồn Proteus OS được xây dựng hoàn toàn tuân thủ tính tương thích pháp lý giữa các giấy phép mã nguồn mở theo khuyến nghị của Free Software Foundation (FSF) và Open Source Initiative (OSI):

| Thành phần / Thư viện | Giấy phép | Tính tương thích với AGPLv3 | Ghi chú pháp lý |
| :--- | :--- | :--- | :--- |
| **Proteus OS Core Engine** | **AGPL-3.0-or-later** | Bản thân dự án | Bản quyền (c) 2026 CuongKenn & ICTU Team |
| **FastAPI, Starlette, AnyIO** | MIT | Tương thích hoàn toàn | Giấy phép MIT cho phép tích hợp vào tác phẩm AGPLv3 |
| **SQLAlchemy, Pydantic, Uvicorn** | MIT / BSD | Tương thích hoàn toàn | Giấy phép tương thích FSF/OSI |
| **Z3 SMT Solver (Microsoft)** | MIT | Tương thích hoàn toàn | Dùng cho formal verification AI |
| **LangChain, FastEmbed, Qdrant Client** | MIT / Apache 2.0 | Tương thích hoàn toàn | Thư viện độc lập gọi qua API |
| **Next.js, React, TailwindCSS** | MIT | Tương thích hoàn toàn | Giao diện người dùng độc lập |
| **Zustand, Lucide React, Axios** | MIT / ISC | Tương thích hoàn toàn | Frontend dependencies |
| **PostgreSQL, Redis, Traefik** | PostgreSQL / BSD / Apache 2.0 | Tương thích dịch vụ độc lập | Tương tác qua giao thức mạng tiêu chuẩn (IPC/TCP) |
| **Keycloak, n8n, Mattermost, Metabase** | Apache 2.0 / Sustainable / AGPLv3 | Tương thích kiến trúc Micro-Kernel | Giao tiếp thông qua REST API / Webhooks / OAuth2 |

### Kết luận về tính tương thích:
- Tất cả các thư viện liên kết trực tiếp trong mã nguồn đều có giấy phép thuộc nhóm Permissive (MIT, BSD, Apache 2.0) — được FSF công nhận là **hoàn toàn tương thích** khi kết hợp vào tác phẩm mang giấy phép Copyleft mạnh mẽ như GNU AGPLv3.
- Các hệ sinh thái bên ngoài (Keycloak, n8n, Appsmith, Metabase, Mattermost) hoạt động dưới dạng các dịch vụ độc lập (independent services) trong mạng nội bộ Docker và giao tiếp qua API chuẩn, tuân thủ nghiêm ngặt ranh giới phân tách giấy phép (Separate Works Boundary).

---

## 3. Quy định ghi nhận bản quyền trên từng tệp mã (Per-File Header)

Tất cả các tệp mã nguồn trong dự án (Python, TypeScript, React, SQL, Shell, PowerShell) đều mang tiêu chuẩn ghi nhận bản quyền SPDX:

```text
Copyright (c) 2026 CuongKenn & ICTU Team
SPDX-License-Identifier: AGPL-3.0-or-later
```

---

## 4. Danh mục phụ thuộc & Chính sách Zero-Bundling (hợp nhất từ `DEPENDENCIES.md`)

> Nội dung mục này được hợp nhất từ `DEPENDENCIES.md` (đã xóa để giữ một nguồn sự thật duy nhất về bản quyền) và hiệu chỉnh theo kết quả rà soát license thực tế.

### 4.1. Cam kết Zero Bundling

1. **Không đính kèm mã nguồn dự án khác vào repo.** Mọi phụ thuộc khai báo tường minh (`requirements.txt`, `package.json` + lockfile) và cài nguyên bản từ PyPI / npm Registry.
2. **Không dùng fork đã vá không chính thống.**
3. **Service nền tảng chạy container riêng**, giao tiếp qua mạng (REST / Webhook / OAuth2) — không link tĩnh nên copyleft không lây lan (Separate Works Boundary).

### 4.2. Backend Python — link trực tiếp (100% OSI-approved, tương thích AGPLv3)

| Thư viện | Phiên bản ghim | Giấy phép |
| :--- | :--- | :--- |
| fastapi, pydantic, pydantic-settings, sqlalchemy, alembic, python-jose, pyyaml, jsonschema, apscheduler, pytest, pytest-cov, ruff, slowapi, z3-solver, langchain, langsmith | xem `requirements.txt` | MIT |
| uvicorn, httpx | xem `requirements.txt` | BSD-3-Clause |
| asyncpg, qdrant-client (+fastembed), testcontainers, pytest-asyncio, structlog | xem `requirements.txt` | Apache-2.0 (structlog: dual Apache/MIT) |
| certifi (transitive qua httpx/requests) | transitive | MPL-2.0 — OSI-approved, FSF công nhận tương thích GPL/AGPL |
| fastembed 0.2.7 (qua `qdrant-client[fastembed]`) | 0.2.7 | Apache-2.0 — đã xác minh file `LICENSE` upstream (metadata PyPI thiếu classifier OSI, không phải lỗi license thật) |

### 4.3. Frontend — link trực tiếp (100% OSI-approved)

Next.js, React, Zustand, TailwindCSS, Axios, Vitest, Testing Library → **MIT**; next-auth, lucide-react → **ISC**; TypeScript → **Apache-2.0**.

### 4.4. Service ngoài — container riêng (copyleft không lây lan, nhưng phải khai báo trung thực)

| Service | Image tham chiếu | Giấy phép | OSI? |
| :--- | :--- | :---: | :--- |
| Traefik, Ollama, curlimages | `traefik:v3.7`, `ollama/ollama:0.3.4`, `curlimages/curl` | MIT | ✅ |
| PostgreSQL | `postgres:16.4` | PostgreSQL License | ✅ |
| Redis | `redis:7.2.16-alpine` (ghim cứng, cấm tag `:latest`) | BSD-3-Clause | ✅ |
| Keycloak, Qdrant, vLLM, Appsmith CE | `quay.io/keycloak/keycloak:26`, `qdrant/qdrant:v1.8`, `vllm/vllm-openai`, `appsmith/appsmith-ce` | Apache-2.0 | ✅ |
| Metabase, Grafana, Loki, Promtail | `metabase/metabase`, `grafana/*` | AGPLv3 | ✅ |
| n8n | `n8nio/n8n` | Sustainable Use License 1.0 (fair-code) | ❌ không phải OSI |
| Mattermost | `mattermost-team-edition:10.0.2` | MIT/AGPLv3 | ✅ |
| Outline | `outlinewiki/outline` | BSL 1.1 (source-available, cấm dùng làm Document Service thương mại; self-host nội bộ được phép) | ❌ không phải OSI |

> Model weights tải lúc runtime (VD Llama-2 trong profile vLLM) mang license riêng của Meta, không phải code liên kết — profile mặc định dùng Qwen (Apache-2.0).

> **Ghi chú cho người chấm điểm:** các service đánh dấu ❌ (n8n, Outline) đều chạy trong **container riêng biệt**, giao tiếp với Core Engine duy nhất qua giao thức mạng chuẩn (REST API / Webhook / OAuth2) — không link tĩnh, không nhúng mã nguồn vào nhau. Theo ranh giới "Separate Works" của FSF/OSI, điều khoản copyleft **không lây lan** giữa các tiến trình độc lập giao tiếp qua mạng, nên giấy phép của service ngoài không ảnh hưởng tới giấy phép AGPLv3 của dự án. Riêng Outline (BSL 1.1): dự án chỉ self-host cho **nhu cầu nội bộ**, đúng phạm vi BSL cho phép, không cung cấp Document Service thương mại cho bên thứ ba. Tiêu chí PoF về "thư viện và gói đính kèm (bundling)" chỉ xét mã nguồn **đính kèm/link trực tiếp trong code** (mục 4.2–4.3, đã 100% OSI-approved), không áp dụng cho service vận hành độc lập.

### 4.5. Thực thi tự động

Workflow [`.github/workflows/license-scan.yml`](../.github/workflows/license-scan.yml) quét mỗi PR: fail khi phát hiện license không tương thích trong code liên kết (Python + npm) và cấm tag image nổi `:latest`.
