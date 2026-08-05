# Đặc tả Ngôn ngữ Thực thi AI (DX-DSL Specification)

**Phiên bản:** 1.0.0  
**Ngày tạo:** 2026-08-05  
**Trạng thái:** Draft — Đang phát triển

---

## 1. Tổng quan

**DX-DSL (Domain Execution Domain-Specific Language)** là chuẩn ngôn ngữ trung gian dạng JSON mà AI Orchestrator của Proteus OS sử dụng để biểu diễn một lệnh thực thi. Sau khi AI phân tích ngôn ngữ tự nhiên của người dùng (bằng LangChain + RAG), nó tạo ra một cấu trúc DX-DSL chuẩn và gửi cho Orchestrator để validate và thực thi.

### Tại sao cần DSL?

Thay vì AI trực tiếp tạo ra code hoặc SQL (rủi ro SQL Injection, lệnh nguy hiểm), DSL đóng vai trò như **"menu thực đơn"** — AI chỉ được gọi các món trong menu, không được "nấu ăn tự do". Điều này đảm bảo:
- **Bảo mật:** Orchestrator chặn mọi action không nằm trong whitelist.
- **Audit:** Mọi lệnh đều có cấu trúc cố định, dễ log và kiểm soát.
- **Kiểm tra phê duyệt:** `effect: write` tự động trigger quy trình Human-in-the-loop.

---

## 2. Cấu trúc DSL cơ bản

```json
{
  "dsl_version": "1.0",
  "command_id": "uuid-v4",
  "session_id": "uuid-v4",
  "created_at": "2026-08-05T15:00:00Z",
  "issued_by": {
    "user_id": "uuid-v4",
    "tenant_id": "uuid-v4",
    "roles": ["hr_manager", "leave_approver"]
  },
  "action": "hr.leave_requests.batch_approve",
  "effect": "write",
  "parameters": {
    "filter": {
      "date": "2026-08-05",
      "status": "pending"
    }
  },
  "dry_run_result": {
    "affected_count": 12,
    "preview": [
      { "id": "uuid-1", "employee_name": "Nguyễn Văn A", "days": 2 },
      { "id": "uuid-2", "employee_name": "Trần Thị B", "days": 1 }
    ]
  },
  "approval_required": true,
  "approval_deadline": "2026-08-05T15:30:00Z",
  "approval_message": "⚠️ Tôi chuẩn bị DUYỆT 12 đơn nghỉ phép ngày 05/08/2026. Vui lòng xác nhận."
}
```

### Mô tả các trường

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `dsl_version` | string | ✅ | Phiên bản spec DSL (dùng để backward compatibility) |
| `command_id` | uuid | ✅ | ID duy nhất của lệnh này |
| `session_id` | uuid | ✅ | ID phiên chat (nhóm các lệnh liên quan) |
| `created_at` | ISO 8601 | ✅ | Thời điểm tạo lệnh |
| `issued_by` | object | ✅ | Thông tin người ra lệnh (từ JWT) |
| `action` | string | ✅ | Tên action theo chuẩn `{plugin}.{resource}.{verb}` |
| `effect` | enum | ✅ | Mức độ tác động: `read`, `write`, `critical` |
| `parameters` | object | ✅ | Tham số đầu vào của action |
| `dry_run_result` | object | Nếu effect=write | Kết quả "chạy thử" để hiển thị cho người phê duyệt |
| `approval_required` | boolean | ✅ | `true` nếu effect=write hoặc effect=critical |
| `approval_deadline` | ISO 8601 | Nếu approval_required | Thời điểm hết hạn chờ phê duyệt (write=+30phút, critical=+15phút). Sau deadline, Orchestrator tự động hủy lệnh và báo cáo timeout. |
| `approval_message` | string | Nếu approval_required | Nội dung tin nhắn Mattermost gửi cho BGĐ |

---

## 3. Quy tắc Đặt tên Action (`action` field)

Tất cả action phải tuân theo định dạng:
```
{plugin_code_name}.{resource}.{verb}
```

### 3.1. Danh sách Action được phép (Action Whitelist)

> [!IMPORTANT]
> Đây là **danh sách trắng (whitelist) duy nhất** các action AI được phép tạo ra. Orchestrator sẽ từ chối (400 Bad Request) bất kỳ `action` nào không có trong danh sách này.

#### Nhóm `core` — Hành động hệ thống cốt lõi

| Action | Effect | Mô tả |
|---|---|---|
| `core.plugins.list` | read | Liệt kê Plugin đã cài |
| `core.plugins.install` | write | Cài đặt Plugin mới |
| `core.users.list` | read | Liệt kê người dùng trong Tenant |
| `core.users.deactivate` | critical | Vô hiệu hóa tài khoản người dùng |
| `core.knowledge.search` | read | Tìm kiếm tài liệu nội bộ (RAG) |
| `core.knowledge.ingest` | write | Nạp tài liệu mới vào RAG pipeline |

#### Nhóm `hr` — Plugin Quản lý Nhân sự

| Action | Effect | Mô tả |
|---|---|---|
| `hr.employees.list` | read | Liệt kê nhân viên |
| `hr.employees.get` | read | Xem thông tin chi tiết nhân viên |
| `hr.leave_requests.list` | read | Xem danh sách đơn nghỉ phép |
| `hr.leave_requests.approve` | write | Duyệt 1 đơn nghỉ phép |
| `hr.leave_requests.batch_approve` | write | Duyệt nhiều đơn theo filter |
| `hr.leave_requests.reject` | write | Từ chối đơn nghỉ phép |
| `hr.reports.attendance` | read | Xem báo cáo chấm công |
| `hr.reports.leave_summary` | read | Xem báo cáo tổng hợp nghỉ phép |

#### Nhóm `finance` — Plugin Kế toán (Dự kiến)

| Action | Effect | Mô tả |
|---|---|---|
| `finance.invoices.list` | read | Xem danh sách hóa đơn |
| `finance.invoices.approve` | write | Duyệt hóa đơn thanh toán |
| `finance.reports.cashflow` | read | Xem báo cáo dòng tiền |
| `finance.transfers.initiate` | critical | Khởi tạo lệnh chuyển khoản |

---

## 4. Effect Levels & Quy tắc Phê duyệt

| Effect | Mô tả | Yêu cầu phê duyệt | Timeout chờ phê duyệt |
|---|---|---|---|
| `read` | Chỉ đọc dữ liệu, không thay đổi gì | ❌ Không | N/A |
| `write` | Thay đổi dữ liệu hoặc kích hoạt workflow | ✅ Phê duyệt 1 lần | 30 phút |
| `critical` | Hành động không thể hoàn tác (xóa dữ liệu, chuyển tiền) | ✅ Phê duyệt 2 lần (2 người) | 15 phút |

> [!CAUTION]
> Khi `effect = critical`, hệ thống yêu cầu **2 người** bấm [Phê duyệt] (VD: Giám đốc + Kế toán trưởng). Chỉ sau khi cả hai đồng ý thì Orchestrator mới thực thi.

---

## 5. Trường `parameters` cho từng Action

### 5.1. `hr.leave_requests.batch_approve`

> **Lưu ý:** Block JSON bên dưới dùng dấu `//` để đánh dấu comment giải thích cho từng trường. Trong thực tế khi gửi API, phải loại bỏ toàn bộ comment và chỉ gửi JSON thuần tú.

```jsonc
{
  "filter": {
    "date": "2026-08-05",           // ISO date (tùy chọn, dùng khi lọc theo ngày cụ thể)
    "date_range": {                 // Hoặc dùng range (chọn một trong hai, không dùng cả hai)
      "from": "2026-08-01",
      "to": "2026-08-05"
    },
    "status": "pending",            // Bắt buộc: chỉ có thể duyệt đơn đang Ở trạng thái "pending"
    "employee_ids": ["uuid-1"],     // Tùy chọn: giới hạn một số nhân viên cụ thể
    "department": "Kế toán"         // Tùy chọn: giới hạn phòng ban
  },
  "note": "Duyệt theo chỉ đạo của BGĐ ngày 05/08"  // Tùy chọn: ghi chú lý do duyệt
}
```

### 5.2. `core.knowledge.search`

```json
{
  "query": "Quy trình xin nghỉ phép năm",
  "top_k": 5,
  "filter_category": "HR Policy"
}
```

### 5.3. `core.users.deactivate`

```json
{
  "user_id": "uuid-v4",
  "reason": "Nhân viên nghỉ việc ngày 05/08/2026",
  "revoke_sessions_immediately": true
}
```

---

## 6. Validation Rules

Orchestrator phải validate DSL command theo các quy tắc sau TRƯỚC KHI thực thi (hoặc gửi phê duyệt):

| Rule | Mô tả | Lỗi trả về |
|---|---|---|
| **Action whitelist** | `action` phải nằm trong danh sách cho phép | `DSL_INVALID_ACTION` |
| **Permission check** | `issued_by.roles` phải chứa role được phép thực hiện action đó | `DSL_PERMISSION_DENIED` |
| **Plugin installed** | Plugin tương ứng với action phải đang ở trạng thái `ACTIVE` | `DSL_PLUGIN_NOT_ACTIVE` |
| **Parameters schema** | `parameters` phải đúng JSON Schema của action đó | `DSL_INVALID_PARAMETERS` |
| **Version compatibility** | `dsl_version` phải là phiên bản Orchestrator hỗ trợ | `DSL_VERSION_UNSUPPORTED` |
| **Dry run before write** | Nếu `effect = write`, Orchestrator chạy dry-run trước để điền `dry_run_result` | N/A (bắt buộc nội bộ) |

---

## 7. Ví dụ End-to-End

### Kịch bản: Giám đốc ra lệnh "Cho tôi biết có bao nhiêu người xin nghỉ tuần này"

**Input (ngôn ngữ tự nhiên):**
```
"Cho tôi biết có bao nhiêu người xin nghỉ tuần này"
```

**DSL được tạo ra (effect = read, không cần phê duyệt):**
```json
{
  "dsl_version": "1.0",
  "command_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "7d793037-a076-4c06-8fde-1b9b7b16e01b",
  "created_at": "2026-08-05T15:00:00Z",
  "issued_by": {
    "user_id": "abc-123",
    "tenant_id": "xyz-456",
    "roles": ["director"]
  },
  "action": "hr.leave_requests.list",
  "effect": "read",
  "parameters": {
    "filter": {
      "date_range": {
        "from": "2026-08-03",
        "to": "2026-08-09"
      },
      "status": "all"
    }
  },
  "approval_required": false
}
```

**Kết quả trả về ngay (không chờ phê duyệt):**
```
📊 Tuần từ 03/08 đến 09/08/2026:
- Tổng số đơn: 15
- Đã duyệt: 8
- Đang chờ duyệt: 5
- Bị từ chối: 2
```

---

## 8. Lịch sử Phiên bản (DSL Changelog)

| Phiên bản | Ngày | Thay đổi |
|---|---|---|
| 1.0.0 | 2026-08-05 | Phiên bản đầu tiên. Định nghĩa cấu trúc cơ bản, effect levels, và action whitelist cho module `core` và `hr`. |
