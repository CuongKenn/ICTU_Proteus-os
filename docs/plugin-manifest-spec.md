# Đặc tả Plugin Manifest (Plugin Manifest Specification)

**Phiên bản:** 1.1.0  
**Ngày tạo:** 2026-08-06  
**Trạng thái:** Draft — Đang phát triển

---

## 1. Tổng quan

File `manifest.yaml` là **"thẻ căn cước"** của mỗi Plugin trong Proteus OS. Khi `tenant_admin` bấm nút **[Cài đặt]** trên Plugin Marketplace, Plugin Manager sẽ đọc file này để biết cần phải làm gì: tạo bảng nào trong Database, nạp Workflow nào vào n8n, tạo Dashboard nào trên Metabase, và cấp những Role nào cho người dùng.

Mọi Plugin **bắt buộc** phải có file `manifest.yaml` đặt ở thư mục **gốc** của plugin.

```
plugins/
└── hr-module/
    ├── manifest.yaml        ← BẮT BUỘC, đặt ở thư mục gốc
    ├── db/
    │   └── seed_data.sql
    ├── workflows/
    │   ├── leave_request.json
    │   └── employee_onboarding.json
    ├── dashboards/
    │   └── hr_metrics.json
    ├── ui/
    │   └── appsmith_app.json
    └── migrations/
        ├── V1.0.0__initial.sql
        └── V1.1.0__add_department.sql
```

---

## 2. Schema đầy đủ của manifest.yaml

```yaml
# ============================================================
# PHẦN 1: METADATA — Thông tin định danh của Plugin
# ============================================================
name: "hr-module"                    # BẮT BUỘC. Định danh duy nhất (kebab-case, không khoảng trắng)
display_name: "HR Core Pro"          # BẮT BUỘC. Tên hiển thị trên Marketplace
version: "1.2.0"                     # BẮT BUỘC. Phiên bản (Semantic Versioning: MAJOR.MINOR.PATCH)
description: |                       # BẮT BUỘC. Mô tả ngắn (hiển thị trên Plugin Card, tối đa 200 ký tự)
  Quản lý nhân sự toàn diện: hồ sơ nhân viên,
  chấm công, quản lý nghỉ phép và bảng lương cơ bản.
author: "ICTU Team"                  # BẮT BUỘC. Tên tác giả hoặc tổ chức
license: "AGPL-3.0"                  # BẮT BUỘC. Mã giấy phép SPDX
icon_url: "/plugins/hr-module/icon.png"  # Tùy chọn. URL icon 128x128px
is_official: true                    # Tùy chọn. true = Plugin chính thức của ICTU (mặc định: false)
homepage_url: "https://github.com/CuongKenn/ICTU_Proteus-os"  # Tùy chọn

# ============================================================
# PHẦN 2: COMPATIBILITY — Yêu cầu tương thích
# ============================================================
compatibility:
  proteus_os_min_version: "1.0.0"  # BẮT BUỘC. Phiên bản Proteus OS tối thiểu để cài
  dsl_spec_version: "1.0"          # Tùy chọn. Phiên bản DX-DSL tối thiểu (nếu có AI actions)

# ============================================================
# PHẦN 3: DATABASE — Khởi tạo cơ sở dữ liệu
# ============================================================
database:
  # `tables` là BẮT BUỘC nếu Plugin tạo bất kỳ bảng nào trong DB.
  # Plugin Manager dùng danh sách này để: (1) tự động thêm cột `tenant_id`,
  # (2) áp dụng RLS Policy — bất kể Plugin dùng seed_file hay migration script.
  tables:
    - "hr_employees"
    - "hr_leave_requests"
    - "hr_attendance_logs"

  # `seed_file` là TÙY CHỌN. File SQL chạy một lần khi cài đặt lần đầu,
  # dùng để tạo cấu trúc bảng (CREATE TABLE) và dữ liệu mẫu (INSERT).
  # Không cần thêm cột tenant_id trong file này — Plugin Manager tự inject.
  seed_file: "db/seed_data.sql"

  # `default_config` là TÙY CHỌN. Cấu hình mặc định của Plugin.
  # tenant_admin có thể override các giá trị này qua TENANT_PLUGIN.config_override.
  default_config:
    max_leave_days_per_year: 12      # Số ngày nghỉ phép tối đa mỗi năm
    leave_approval_required: true    # Yêu cầu phê duyệt đơn nghỉ phép?
    notify_channel: "hr-alerts"      # Kênh Mattermost nhận cảnh báo

# ============================================================
# PHẦN 4: WORKFLOWS — Luồng quy trình n8n
# ============================================================
# Tất cả đường dẫn trong workflows[] là đường dẫn TƯƠNG ĐỐI từ thư mục gốc plugin.
workflows:
  - file: "workflows/leave_request.json"   # BẮT BUỘC. Đường dẫn tương đối từ thư mục gốc plugin
    name: "HR Leave Request Workflow"      # BẮT BUỘC. Tên hiển thị trong n8n
    description: "Xử lý luồng duyệt đơn nghỉ phép"
    trigger: "webhook"                     # BẮT BUỘC. Loại trigger: webhook | cron | manual

  - file: "workflows/employee_onboarding.json"
    name: "Employee Onboarding Workflow"
    description: "Tạo tài khoản hệ thống khi nhân viên mới vào"
    trigger: "webhook"

  - file: "workflows/leave_balance_check.json"
    name: "Leave Balance Daily Check"
    description: "Kiểm tra và reset số ngày phép đầu năm mới"
    trigger: "cron"
    cron_expression: "0 1 1 1 *"          # BẮT BUỘC khi trigger=cron. Cron 5 trường (phút giờ ngày tháng tuần)
    # Ví dụ các giá trị cron phổ biến:
    # "0 7 * * *"    → 7h sáng mỗi ngày
    # "*/30 * * * *" → Mỗi 30 phút
    # "0 1 1 1 *"    → 1h sáng ngày 1 tháng 1 (đầu năm mới)

# ============================================================
# PHẦN 5: DASHBOARDS — Báo cáo Metabase
# ============================================================
dashboards:
  - file: "dashboards/hr_metrics.json"    # Đường dẫn tương đối từ thư mục gốc plugin
    name: "HR Overview Dashboard"
    description: "Tổng quan nhân sự: headcount, nghỉ phép, chấm công"

# ============================================================
# PHẦN 6: UI APPLICATIONS — Giao diện Appsmith
# ============================================================
ui_apps:
  - file: "ui/appsmith_app.json"    # Đường dẫn tương đối từ thư mục gốc plugin
    name: "HR Management App"
    # `path` là đường dẫn hiển thị trên Proteus OS Launchpad.
    # QUY TẮC:
    #   - BẮT BUỘC bắt đầu bằng /apps/ để tránh xung đột với path hệ thống
    #   - Không được trùng với path hệ thống: /auth, /api, /chat, /files,
    #     /wiki, /workflow, /analytics, /monitoring
    #   - Phải là duy nhất trong toàn bộ Tenant (Plugin Manager kiểm tra trước khi cài)
    #   - Nếu xung đột, Plugin Manager từ chối cài và báo lỗi PATH_CONFLICT
    path: "/apps/hr"

# ============================================================
# PHẦN 7: ROLES — Phân quyền tự động
# ============================================================
# Plugin Manager tự động tạo các Role này trong bảng ROLE của PostgreSQL
# (với tenant_id tương ứng) và đồng bộ lên Keycloak Realm của Tenant khi cài đặt.
# Roles sẽ bị xóa hoàn toàn khi Plugin bị gỡ bỏ.
#
# Về `permissions[]`:
#   Format: "{plugin_code_name}:{resource}:{action}"
#   Đây là Permission String lưu trong bảng ROLE.permissions (jsonb) trên PostgreSQL.
#   Keycloak lưu tên Role (VD: "hr_manager"), còn Permission String dùng để
#   enforce fine-grained access control trong FastAPI middleware.
roles:
  - name: "hr_manager"                    # Tên Role trong Keycloak và DB
    display_name: "HR Manager"
    description: "Quản lý nhân sự toàn quyền: xem, thêm, sửa nhân viên, duyệt nghỉ phép"
    permissions:
      - "hr:employees:read"
      - "hr:employees:write"
      - "hr:leave_requests:read"
      - "hr:leave_requests:approve"
      - "hr:reports:read"

  - name: "hr_viewer"
    display_name: "HR Viewer"
    description: "Chỉ xem thông tin nhân sự, không thể thay đổi"
    permissions:
      - "hr:employees:read"
      - "hr:leave_requests:read"
      - "hr:reports:read"

  - name: "leave_approver"
    display_name: "Leave Approver"
    description: "Duyệt/từ chối đơn nghỉ phép trong phạm vi được phân công"
    permissions:
      - "hr:leave_requests:read"
      - "hr:leave_requests:approve"

# ============================================================
# PHẦN 8: EVENT SUBSCRIPTIONS — Giao tiếp liên Plugin (nhận)
# ============================================================
# Khai báo các Event mà Plugin này lắng nghe từ Plugin khác qua Redis Pub/Sub.
# Plugin Manager tự động cấu hình n8n Webhook để nhận events khi cài đặt.
# Chi tiết Event Schema và quy tắc đặt tên: docs/clarification.md §6
#
# Lưu ý: handler_workflow là đường dẫn TƯƠNG ĐỐI từ thư mục gốc plugin.
event_subscriptions:
  - source_plugin: "finance-module"
    event_types:
      - "finance.payroll.processed"
    handler_workflow: "workflows/sync_payroll_result.json"

# ============================================================
# PHẦN 9: EVENT PUBLICATIONS — Sự kiện Plugin này phát ra (gửi)
# ============================================================
# Khai báo các Event Plugin này phát lên Redis để Plugin khác có thể Subscribe.
# Đây là "Event API Contract" — Plugin khác sẽ khai báo những event_type này
# trong event_subscriptions của họ.
#
# QUAN TRỌNG: payload_schema chỉ mô tả phần BÊN TRONG trường `payload` của Event.
# Wrapper chuẩn bên ngoài (event_id, event_type, tenant_id, plugin_source,
# created_at) được Plugin Manager tự động inject — Plugin không cần tự thêm.
# Xem cấu trúc Event đầy đủ tại: docs/clarification.md §6.4
event_publications:
  - event_type: "hr.employee.created"         # Theo chuẩn: {plugin}.{resource}.{past_tense}
    description: "Khi một nhân viên mới được tạo thành công"
    # Chỉ khai báo phần BÊN TRONG payload{}, không khai báo wrapper
    payload_schema:
      employee_id: "uuid"
      full_name: "string"
      department: "string"
      hire_date: "date"           # ISO 8601 date: "YYYY-MM-DD"
      position: "string"

  - event_type: "hr.employee.deactivated"
    description: "Khi tài khoản nhân viên bị vô hiệu hóa"
    payload_schema:
      employee_id: "uuid"
      deactivated_at: "datetime"  # ISO 8601 datetime: "YYYY-MM-DDTHH:mm:ssZ"
      reason: "string"

  - event_type: "hr.leave_request.approved"
    description: "Khi một đơn nghỉ phép được duyệt"
    payload_schema:
      leave_request_id: "uuid"
      employee_id: "uuid"
      approved_by_user_id: "uuid"
      start_date: "date"
      end_date: "date"
      days_count: "integer"

# ============================================================
# PHẦN 10: DEPENDENCIES — Phụ thuộc Plugin khác
# ============================================================
# Plugin Manager kiểm tra dependencies trước khi cài đặt.
# `required`: Nếu dependency chưa cài → Plugin Manager TỪ CHỐI cài đặt.
# `optional`: Nếu dependency chưa cài → Cảnh báo, vẫn cho phép cài.
#             event_subscriptions liên quan sẽ được kích hoạt sau khi dep được cài xong.
dependencies:
  required: []                              # Không có dependency bắt buộc
  optional:
    - plugin: "finance-module"
      reason: "Để tự động đồng bộ thông tin lương khi tạo nhân viên mới"
      min_version: "1.0.0"                  # Tùy chọn. Phiên bản tối thiểu của dependency
```

---

## 3. Mô tả chi tiết từng Phần

### 3.1. PHẦN 1: Metadata

| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `name` | string | ✅ | `kebab-case`, chỉ chứa chữ thường, số và dấu `-`. Dùng làm `code_name` trong DB. Không thể thay đổi sau khi publish |
| `display_name` | string | ✅ | Hiển thị trên Marketplace Card, tối đa 50 ký tự |
| `version` | string | ✅ | Semantic Versioning. VD: `"1.0.0"`. Phải tăng mỗi khi publish bản mới |
| `description` | string | ✅ | Tối đa 200 ký tự, hỗ trợ multiline YAML (`|`) |
| `author` | string | ✅ | Tên tác giả/team |
| `license` | string | ✅ | Mã SPDX. Plugin chính thức phải là `"AGPL-3.0"` |
| `icon_url` | string | ❌ | URL tương đối hoặc tuyệt đối, ảnh 128×128px. Mặc định: icon placeholder |
| `is_official` | boolean | ❌ | Mặc định `false`. Chỉ `superadmin` mới có thể publish Plugin với `is_official: true` |
| `homepage_url` | string | ❌ | URL trang chủ hoặc repo GitHub của Plugin |

### 3.2. PHẦN 3: Database

> [!IMPORTANT]
> `tables[]` và `seed_file` là **hai thứ độc lập**:
> - **`tables[]`** — BẮT BUỘC nếu Plugin tạo bảng. Plugin Manager dùng danh sách này để tự động thêm cột `tenant_id` (UUID, NOT NULL, FK → `tenants.id`) và áp dụng RLS Policy. Plugin không cần tự thêm `tenant_id` trong `seed_data.sql`.
> - **`seed_file`** — TÙY CHỌN. File SQL chạy một lần để tạo cấu trúc bảng (`CREATE TABLE`) và dữ liệu khởi tạo (`INSERT`). Nếu không có `seed_file`, Plugin dùng `migrations/V{x.y.z}__initial.sql` thay thế.

> [!WARNING]
> Tên bảng **bắt buộc có prefix** là `name` của Plugin (đã chuyển dấu `-` thành `_`). VD: Plugin `hr-module` → prefix `hr_`, Plugin `finance-module` → prefix `finance_`. Mọi bảng không đúng prefix sẽ bị Plugin Manager từ chối khi cài.

**`default_config`** là cấu hình mặc định của Plugin. `tenant_admin` có thể ghi đè các giá trị này qua trường `config_override` trong bảng `TENANT_PLUGIN`. Tất cả key trong `default_config` phải là kiểu primitive (`string`, `integer`, `boolean`).

### 3.3. PHẦN 4: Workflows

Khi `trigger: cron`, **bắt buộc** cung cấp thêm trường `cron_expression` theo chuẩn 5 trường:

```
┌──────── phút (0-59)
│ ┌────── giờ (0-23)
│ │ ┌──── ngày trong tháng (1-31)
│ │ │ ┌── tháng (1-12)
│ │ │ │ ┌ ngày trong tuần (0-7, 0 và 7 đều là Chủ nhật)
│ │ │ │ │
* * * * *
```

| Trigger | Trường bổ sung | Ghi chú |
|---|---|---|
| `webhook` | Không cần | n8n tự tạo Webhook URL. Plugin Manager lưu URL này để truyền vào Event Bus |
| `cron` | `cron_expression` (bắt buộc) | Plugin Manager đăng ký Cron Job trực tiếp trong n8n |
| `manual` | Không cần | Chỉ chạy khi Admin bấm nút thủ công trong n8n UI |

### 3.4. PHẦN 5: Dashboards

Mỗi Dashboard trong Metabase phải được export ra file JSON từ Metabase UI. Plugin Manager dùng Metabase API để import. Metabase sẽ tự động áp filter `tenant_id` theo cấu hình Locked Parameter.

### 3.5. PHẦN 6: UI Apps

| Quy tắc | Mô tả |
|---|---|
| **Prefix bắt buộc** | `path` phải bắt đầu bằng `/apps/` |
| **Path duy nhất** | Plugin Manager kiểm tra conflict trước khi cài. Nếu trùng → lỗi `PATH_CONFLICT` |
| **Path bị cấm** | Không được trùng với path hệ thống: `/auth`, `/api`, `/chat`, `/files`, `/wiki`, `/workflow`, `/analytics`, `/monitoring` |
| **Format** | Chỉ chứa chữ thường, số, dấu `-` và `/`. VD: `/apps/hr`, `/apps/finance-dashboard` |

### 3.6. PHẦN 7: Roles

**Về `permissions[]`:** Format chuẩn là `"{plugin_code_name}:{resource}:{action}"`.

Plugin Manager lưu danh sách này vào cột `permissions` (jsonb) trong bảng `ROLE` của PostgreSQL. FastAPI middleware đọc Permission String từ đây để enforce fine-grained access control. Keycloak chỉ lưu **tên Role** (VD: `hr_manager`) — không lưu Permission String.

| Thành phần | Ví dụ | Mô tả |
|---|---|---|
| `plugin_code_name` | `hr` | Tên plugin (bỏ `-module`, chỉ lấy phần đầu) |
| `resource` | `employees`, `leave_requests`, `reports` | Tài nguyên trong plugin |
| `action` | `read`, `write`, `approve`, `delete` | Hành động được phép |

**Ví dụ Permission Strings cho HR Plugin:**
- `hr:employees:read` — Xem danh sách nhân viên
- `hr:employees:write` — Tạo/sửa nhân viên
- `hr:leave_requests:approve` — Duyệt đơn nghỉ phép
- `hr:reports:read` — Xem báo cáo

### 3.7. PHẦN 8 & 9: Event Bus

**Cấu trúc Event đầy đủ khi phát lên Redis** (Plugin Manager tự inject wrapper, Plugin chỉ cung cấp `payload`):

```json
{
  "event_id": "uuid-v4",              ← Plugin Manager inject
  "event_type": "hr.employee.created",← Plugin Manager inject (từ event_publications)
  "tenant_id": "uuid-truong-a",       ← Plugin Manager inject (từ JWT context)
  "plugin_source": "hr-module",       ← Plugin Manager inject (từ manifest.name)
  "created_at": "2026-08-06T10:00:00Z",← Plugin Manager inject
  "payload": {
    "employee_id": "uuid-v4",         ← Plugin khai báo trong payload_schema
    "full_name": "Nguyễn Văn A",
    "department": "Kế toán",
    "hire_date": "2026-08-06",
    "position": "Kế toán viên"
  }
}
```

Xem chi tiết quy tắc đặt tên Event và ví dụ end-to-end tại: [`docs/clarification.md §6`](./clarification.md)

---

## 4. Vòng đời Cài đặt (Installation Lifecycle)

```
tenant_admin bấm [Cài đặt]
         ↓
Plugin Manager đọc manifest.yaml + kiểm tra dependencies
         ↓ Thiếu required dependency → Lỗi DEPENDENCY_NOT_INSTALLED, dừng
         ↓ OK
Hiện Preview cho Admin: số bảng DB, số workflow, roles được tạo, ...
         ↓
Admin bấm [Xác nhận]
         ↓
TENANT_PLUGIN.status = INSTALLING
         ↓
┌─────────────────────────────────────────────────────────────────┐
│  Compensating Transaction (chạy tuần tự, rollback nếu thất bại) │
│                                                                  │
│  Bước 1: Chạy database.seed_file (hoặc migrations/V*.sql)       │
│           → Tạo bảng + Plugin Manager tự thêm tenant_id + RLS   │
│  Bước 2: Nạp workflows[] vào n8n                                 │
│           → Đăng ký Webhook URL hoặc Cron Expression             │
│  Bước 3: Nạp dashboards[] vào Metabase                           │
│           → Import Dashboard JSON + set Locked Parameter         │
│  Bước 4: Nạp ui_apps[] vào Appsmith                              │
│           → Import App JSON + kiểm tra PATH_CONFLICT             │
│  Bước 5: Tạo roles[] trong Keycloak Realm + bảng ROLE (DB)       │
│  Bước 6: Đăng ký event_subscriptions[] vào n8n Webhook           │
└─────────────────────────────────────────────────────────────────┘
         ↓ Tất cả thành công           ↓ Có bước thất bại
TENANT_PLUGIN.status = ACTIVE  TENANT_PLUGIN.status = FAILED_DIRTY
Gửi thông báo Mattermost ✅           ↓
                               install_error_log = stacktrace
                               Cleanup Agent dọn dẹp ngầm
                               Gửi thông báo Mattermost 🔴
```

---

## 5. Vòng đời Gỡ cài đặt (Uninstall Lifecycle)

> [!CAUTION]
> Gỡ cài đặt Plugin sẽ **XÓA VĨNH VIỄN** toàn bộ dữ liệu nghiệp vụ của Tenant cho Plugin đó (bảng DB, workflow, dashboard, UI). Hành động này **không thể hoàn tác**. Plugin Manager bắt buộc phải hiện cảnh báo và yêu cầu Admin xác nhận lần 2 trước khi thực hiện.

```
tenant_admin bấm [Gỡ cài đặt]
         ↓
Plugin Manager hiện cảnh báo: "Toàn bộ dữ liệu sẽ bị xóa vĩnh viễn!"
         ↓
Admin nhập chuỗi xác nhận: gõ tên plugin (VD: "hr-module") để confirm
         ↓
TENANT_PLUGIN.status = UNINSTALLING
         ↓
┌─────────────────────────────────────────────────────────────────┐
│  Compensating Transaction (rollback ngược thứ tự cài đặt)       │
│                                                                  │
│  Bước 1: Hủy đăng ký event_subscriptions[] khỏi n8n Webhook     │
│  Bước 2: Xóa roles[] khỏi Keycloak Realm + bảng ROLE (DB)        │
│           → Thu hồi Role của tất cả User trong Tenant            │
│  Bước 3: Xóa ui_apps[] khỏi Appsmith                            │
│  Bước 4: Xóa dashboards[] khỏi Metabase                         │
│  Bước 5: Xóa workflows[] khỏi n8n                               │
│  Bước 6: DROP bảng DB (danh sách trong database.tables[])        │
│           → Toàn bộ dữ liệu nghiệp vụ bị xóa vĩnh viễn         │
└─────────────────────────────────────────────────────────────────┘
         ↓ Tất cả thành công           ↓ Có bước thất bại
TENANT_PLUGIN.status = DELETED  TENANT_PLUGIN.status = FAILED_DIRTY
Gửi thông báo Mattermost ✅           ↓
                               Cleanup Agent xử lý ngầm
```

**Xử lý dependencies khi uninstall:**
- Nếu Plugin B đang khai báo `event_subscriptions` từ Plugin A (sắp bị xóa), Plugin Manager sẽ **cảnh báo** và vô hiệu hóa các subscription đó trong Plugin B trước khi xóa Plugin A.
- Plugin B vẫn tiếp tục hoạt động, nhưng các subscription từ Plugin A sẽ không nhận được Event nữa.

---

## 6. Chiến lược Migration (Nâng cấp Plugin)

Khi phát hành version mới (VD: từ `1.0.0` lên `1.1.0`), Plugin cần cung cấp migration scripts trong thư mục `migrations/`:

```
plugins/hr-module/
└── migrations/
    ├── V1.0.0__initial.sql          # Script khởi tạo (chạy khi cài lần đầu)
    └── V1.1.0__add_department.sql   # Migration khi nâng cấp lên 1.1.0
```

**Quy tắc đặt tên migration file:**
```
V{major}.{minor}.{patch}__{description}.sql
```

Plugin Manager so sánh `installed_version` trong `TENANT_PLUGIN` với `version` trong `manifest.yaml` mới để chạy đúng migration scripts theo thứ tự tăng dần. Nếu migration thất bại, Compensating Transaction sẽ `ROLLBACK` và đặt trạng thái về `FAILED_DIRTY`.

> [!CAUTION]
> Migration script **chỉ được phép**: `ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX`, `INSERT` dữ liệu mặc định. Tuyệt đối **không** `DROP COLUMN`, `DROP TABLE` vì sẽ gây mất dữ liệu của Tenant. Nếu cần loại bỏ, đổi tên cột thành `_deprecated_{tên_cũ}` và lên kế hoạch xóa ở major version tiếp theo.

---

## 7. Lịch sử Phiên bản (Manifest Spec Changelog)

| Phiên bản | Ngày | Thay đổi |
|---|---|---|
| 1.1.0 | 2026-08-06 | Thêm `default_config`, `cron_expression` cho cron trigger, quy tắc `ui_apps.path`, giải thích `permissions[]` format, phân tách `tables` vs `seed_file`, thêm wrapper Event Schema, thêm Uninstall Lifecycle (§5), thêm mô tả §3 cho tất cả các phần, thêm `min_version` trong `dependencies`. |
| 1.0.0 | 2026-08-06 | Phiên bản đầu tiên. 10 phần cơ bản: metadata, compatibility, database, workflows, dashboards, ui_apps, roles, event_subscriptions, event_publications, dependencies. |
