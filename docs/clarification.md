# Giải ngố Proteus OS: Hiểu rõ Hệ thống từ A đến Z

Tài liệu này được biên soạn bằng ngôn ngữ dễ hiểu nhất, kết hợp các hình ảnh ẩn dụ thực tế, nhằm giúp **bất kỳ ai** (từ Ban Giám đốc, Nhân viên văn phòng, đến Lập trình viên hay Tác tử AI) đều có thể nắm bắt trọn vẹn bức tranh tổng thể và sức mạnh thực sự của Proteus OS.

---

## 1. Tóm tắt: Proteus OS là gì?

Hãy tưởng tượng chiếc điện thoại thông minh (Smartphone) của bạn. Khi mới mua về, nó có một hệ điều hành (iOS/Android) với các tính năng cơ bản như Nghe, Gọi, Cài đặt. Sau đó, nếu bạn cần làm gì thêm, bạn sẽ vào **App Store** để tải ứng dụng như Zalo (chat), Facebook (mạng xã hội), Mobile Banking (tài chính). Các ứng dụng này chạy độc lập nhưng đều dùng chung một tài khoản Apple ID/Google Account của bạn, dùng chung mạng và bộ nhớ máy.

**Proteus OS chính là một hệ điều hành giống như vậy, nhưng được thiết kế dưới dạng Lõi Đa năng (Universal OS) dùng cho mọi tổ chức (Doanh nghiệp, Trường học, Y tế, v.v.).**
- **Hạt nhân (Core):** Cung cấp các nền tảng cơ bản nhất như: Đăng nhập một lần (SSO), Không gian lưu trữ, và Kênh giao tiếp.
- **Chợ ứng dụng (Marketplace):** Nơi Ban giám đốc có thể cài đặt thêm các "Plugin" (phân hệ nghiệp vụ) như: Quản lý Nhân sự, Quản lý Điểm số, Kế toán... chỉ bằng **một cú click chuột**.
- **Điểm khác biệt lớn nhất (Agentic AI):** Khác với Windows hay iOS, Proteus OS tích hợp Trí tuệ nhân tạo (AI) hoạt động như một "Trợ lý ảo" có quyền lực thực sự – nó không chỉ biết trả lời câu hỏi mà còn có "chân tay" để tự động bấm duyệt đơn từ, điều phối công việc hay báo cáo dòng tiền thay cho con người.

---

## 2. Giải mã các khái niệm "Khó nhằn" trong Proteus OS

Để hệ thống hoạt động trơn tru, bảo mật và phục vụ được hàng trăm công ty khác nhau cùng lúc, Proteus OS áp dụng 3 triết lý thiết kế cốt lõi. Dưới đây là lời giải thích đơn giản cho từng kỹ thuật:

### 2.1. Đa khách hàng (Multi-Tenancy) - Bài toán "Khu chung cư"
Khi cung cấp phần mềm cho 100 trường học, chúng ta không thể mua 100 máy chủ vật lý riêng lẻ (như vậy sẽ phá sản vì quá tốn kém). Giải pháp của Proteus OS là xây dựng một "Khu chung cư" khổng lồ trên Đám mây (Cloud):
- **Tòa nhà (Keycloak Realms):** Mỗi Trường học được cấp một "Tòa nhà" riêng biệt. Học sinh của trường A không thể lấy thẻ từ của mình để quẹt mở cửa vào trường B. Tài khoản người dùng được hệ thống cô lập hoàn toàn.
- **Căn hộ (Database Schema-per-tenant):** Dữ liệu của trường A (điểm số, danh sách học sinh) được cất trong "Căn hộ A" có ổ khóa riêng. Nếu Trường A tải ứng dụng "Quản lý Canteen" từ Chợ ứng dụng, hệ thống sẽ tự động kê thêm một cái tủ lạnh vào Căn hộ A. Trường B ở phòng bên cạnh sẽ không hề hay biết và cũng không bị ảnh hưởng.
- **Tiện ích chung (Row-Level Security):** Các dữ liệu dùng chung (như Danh sách 63 Tỉnh Thành) giống như hồ bơi chung. Hệ thống (PostgreSQL RLS) sẽ kiểm tra nghiêm ngặt "thẻ cư dân" của từng người để đảm bảo họ lấy đúng phần dữ liệu của mình.

### 2.2. Đăng nhập một lần (SSO) và Phân quyền - Tấm "Thẻ căn cước" vạn năng
Ở các công ty kiểu cũ, nhân viên thường phải nhớ 1 mật khẩu cho Email, 1 mật khẩu cho phần mềm Kế toán, 1 mật khẩu cho phần mềm Chat. 
- Với Proteus OS, người dùng **chỉ cần đăng nhập đúng 1 lần duy nhất** vào buổi sáng.
- Ngay sau khi đăng nhập, hệ thống sẽ cấp cho bạn một tấm "Thẻ căn cước" điện tử vô hình (gọi là JWT Token). Tấm thẻ này ghi rõ: *"Đây là Nguyễn Văn A, chức vụ: Kế toán"*.
- Khi anh A bấm mở bất kỳ ứng dụng nào khác (Chat, Báo cáo, Duyệt đơn), tấm thẻ này sẽ tự động được quét ngầm ở cửa (API Gateway). Các ứng dụng tự động mở ra mà không đòi hỏi mật khẩu nữa. Nếu một người không có quyền (không có chức danh Kế toán trong thẻ), hệ thống sẽ chặn ngay từ vòng gửi xe.

### 2.3. Giao diện "Biết tàng hình" (Dynamic UI)
- Bạn đã bao giờ dùng một phần mềm có hàng trăm nút bấm rối rắm mà bạn chẳng bao giờ đụng tới chưa? 
- Nhờ tấm "Thẻ căn cước" thông minh ở trên, Proteus OS **biết chính xác bạn là ai và bạn cần gì**. 
- Nếu bạn là Nhân sự, Launchpad (màn hình chính) của bạn chỉ hiển thị biểu tượng "Tuyển dụng" và "Chấm công". Mọi chức năng thừa thãi đều "tàng hình" giúp màn hình cực kỳ tối giản.
- **Bảo mật Báo cáo (Metabase Embedding):** Báo cáo là thứ nhạy cảm nhất. Khi Giáo viên chủ nhiệm lớp 10A mở biểu đồ điểm số, Proteus OS sẽ bí mật gửi kèm mã `10A` vào biểu đồ thông qua cơ chế Locked Parameter, đảm bảo biểu đồ chỉ hiện đúng điểm của lớp 10A. Giáo viên không thể xem lén điểm của lớp khác. *(Chi tiết kỹ thuật triển khai xem tại [Mục 4 — Giải mã Metabase Embedding](#4-giải-mã-tính-năng-báo-cáo-an-toàn-metabase-embedding))*

---

## 3. Đồng bộ Tài khoản Keycloak ↔ PostgreSQL

Keycloak là nơi lưu thông tin đăng nhập, còn PostgreSQL lưu thông tin nghiệp vụ của người dùng. Làm thế nào hai hệ thống này luôn "biết" nhau?

### 3.1. Luồng Đồng bộ

Chúng ta sử dụng cơ chế **"First Login Hook"** thay vì đồng bộ theo batch, giúp tạo User record tự động mà không cần cronjob phức tạp.

```
[Người dùng đăng nhập lần đầu]
         ↓
Keycloak xác thực mật khẩu → Cấp JWT Token
         ↓
Next.js BFF nhận Token → Decode JWT → Đọc keycloak_id
         ↓
Next.js gọi FastAPI: GET /auth/me
         ↓
FastAPI kiểm tra: USER nào có keycloak_id này trong PostgreSQL?
    - Nếu KHÔNG CÓ → Tự động INSERT User mới vào PostgreSQL (first-login provisioning)
    - Nếu CÓ → Cập nhật last_login_at, đồng bộ full_name/email nếu đã thay đổi
         ↓
Trả về profile đầy đủ cho Frontend
```

### 3.2. Xử lý khi Admin vô hiệu hóa tài khoản

Kịch bản: Nhân viên nghỉ việc, Admin bấm "Disable" trong Keycloak.
- **Tác động tức thì:** Keycloak thu hồi Session, mọi Token cũ hết hạn (max 5 phút).
- **Đồng bộ PostgreSQL:** Keycloak gửi **Event Webhook** (`user.disabled`) tới FastAPI endpoint `POST /webhooks/keycloak/events`. FastAPI cập nhật `USER.is_active = false`.
- **Kết quả:** Nhân viên bị logout toàn bộ hệ thống (Chat, File, Dashboard) trong vòng 5 phút — đúng với Acceptance Criteria của FR1.

---

## 4. Giải mã Tính năng Báo cáo an toàn (Metabase Embedding)

### 4.1. Thực trạng: Metabase OSS vs Enterprise

> [!IMPORTANT]
> **Tính năng "Signed Embedding" yêu cầu Metabase Enterprise** (trả phí ~$500+/tháng). Dự án sử dụng phương án thay thế miễn phí bên dưới.

### 4.2. Phương án cho Proteus OS (Metabase OSS)

Proteus OS sử dụng **Public Embedding kết hợp Row-Level Security** để đạt mức bảo mật tương đương:

1. **Bộ lọc cứng trên Dashboard:** Mỗi Metabase Question/Dashboard được cấu hình sẵn filter `tenant_id = {{tenant_id}}` dưới dạng Locked Parameter. Người xem không thể thay đổi filter này từ giao diện.

2. **Kiểm soát truy cập qua Traefik:** Trước khi render Iframe Metabase, Next.js BFF gọi API nội bộ để lấy **embed_url** có kèm tham số lọc. URL này có thời gian sống ngắn (TTL 60 giây), không thể tái sử dụng.

3. **Fallback — Metabase Service Account per Tenant:** Mỗi Tenant được cấp một Metabase account riêng, chỉ có quyền xem Dashboard của mình. Keycloak SSO đồng bộ login vào Metabase qua LDAP/OIDC, đảm bảo không cần quản lý mật khẩu riêng.

**Kết quả:** Giáo viên lớp 10A mở biểu đồ điểm số → chỉ thấy điểm lớp 10A. Không thể truy cập biểu đồ của lớp khác.

---

## 5. Cơ chế AI Thực thi Ủy quyền (Human-in-the-Loop)

Đây là tính năng phân biệt Proteus OS với các chatbot thông thường. AI không chỉ "nói chuyện" mà còn có thể **làm việc thật sự**.

### 5.1. Tại sao cần Human-in-the-Loop?

Hãy tưởng tượng AI nghe lệnh "Duyệt tất cả đơn nghỉ phép hôm nay" và **tự động thực thi ngay**. Điều gì xảy ra nếu:
- Có 50 đơn bất thường cùng một ngày (dấu hiệu gian lận)?
- Lệnh bị hiểu nhầm (AI duyệt cả đơn của tuần sau)?
- Người ra lệnh không đủ thẩm quyền?

**Giải pháp:** Mọi hành động thực thi của AI đều phải đi qua nút **[Phê duyệt]** của người có thẩm quyền.

### 5.2. Luồng Hoạt động Chi tiết

```
Giám đốc chat: "Duyệt tất cả đơn xin nghỉ phép hôm nay"
         ↓
AI Orchestrator phân tích → Tạo DX-DSL Command:
{
  "action": "hr.leave_requests.batch_approve",
  "effect": "write",       ← Đây là write action → BẮT BUỘC xin phê duyệt
  "filter": { "date": "today", "status": "pending" },
  "count": 12              ← AI đếm trước để BGĐ biết
}
         ↓
AI gửi Interactive Message lên Mattermost:
"⚠️ Tôi chuẩn bị DUYỆT 12 đơn nghỉ phép ngày 05/08/2026.
 [✅ Phê duyệt]   [❌ Hủy bỏ]"
         ↓
Giám đốc bấm [✅ Phê duyệt]
         ↓
Mattermost gửi callback → FastAPI /webhooks/mattermost/callback
         ↓
FastAPI verify chữ ký HMAC → Kích hoạt n8n Workflow
         ↓
n8n cập nhật 12 đơn trong PostgreSQL → Gửi email thông báo → Callback FastAPI
         ↓
AI báo cáo: "✅ Đã duyệt thành công 12 đơn nghỉ phép. Chi tiết: [link]"
```

### 5.3. Các loại Action và Quy tắc Phê duyệt

| Loại Action | Ví dụ | Cần phê duyệt? |
|---|---|---|
| `effect: read` | "Bao nhiêu nhân viên nghỉ phép hôm nay?" | ❌ Không (trả lời ngay) |
| `effect: write` | "Duyệt đơn nghỉ phép", "Gửi email toàn công ty" | ✅ Bắt buộc |
| `effect: critical` | "Xóa tài khoản nhân viên", "Chuyển khoản ngân hàng" | ✅ Bắt buộc + Xác nhận lần 2 |

---

## 6. Giao tiếp giữa các Plugin — Độc lập hay Kết nối?

Đây là câu hỏi kiến trúc quan trọng. Câu trả lời ngắn gọn là: **Plugin độc lập về dữ liệu, nhưng CÓ THỂ giao tiếp với nhau qua sự kiện (Event-Driven)**.

### 6.1. Nguyên tắc cơ bản: Loose Coupling

Proteus OS thiết kế các Plugin theo nguyên tắc **"Loose Coupling, High Cohesion"** — giống như các ứng dụng trên điện thoại:

- Ứng dụng **Zalo** và **ViettelPay** trên điện thoại bạn không "biết" nhau.
- Nhưng khi bạn nhận được tiền qua Zalo Pay → Zalo **phát ra thông báo** → ViettelPay **nhận được thông báo** → Cả hai cùng cập nhật số dư cho bạn.
- Zalo không cần biết ViettelPay hoạt động như thế nào. ViettelPay cũng không cần truy cập dữ liệu nội bộ của Zalo.

**Proteus OS hoạt động y như vậy với các Plugin.**

### 6.2. Cô lập Dữ liệu (Data Isolation) — Quy tắc Vàng

> [!CAUTION]
> **Tuyệt đối cấm** một Plugin truy vấn trực tiếp vào bảng dữ liệu của Plugin khác (cross-schema query). Đây là nguyên nhân số 1 gây ra "Spaghetti Architecture" trong các hệ thống ERP truyền thống.

Mỗi Plugin khi được cài đặt có **schema dữ liệu riêng biệt**:
- `hr-module` → Có bảng `hr_employees`, `hr_leave_requests`
- `finance-module` → Có bảng `finance_accounts`, `finance_payroll`
- Plugin này **KHÔNG ĐƯỢC** chạy `SELECT * FROM hr_employees` từ trong code của mình.

**Lý do:** Nếu sau này HR Module thay đổi cấu trúc bảng `hr_employees`, Finance Module sẽ bị lỗi ngay lập tức — đây là "tight coupling" cần tránh.

### 6.3. Giao tiếp qua Event Bus (Redis Pub/Sub)

Khi một hành động xảy ra trong Plugin A, nó **phát ra một sự kiện (Event)** vào Event Bus trung tâm (Redis). Plugin B lắng nghe sự kiện đó qua n8n Webhook và xử lý theo logic của mình, hoàn toàn độc lập.

```
Plugin A (HR)                    Redis Pub/Sub              Plugin B (Finance)
     │                               (Event Bus)                    │
     │  Nhân viên mới được tạo           │                          │
     │─── PUBLISH ──────────────────────>│                          │
     │  event: "hr.employee.created"     │                          │
     │  payload: { employee_id, ... }    │                          │
     │                                   │──── SUBSCRIBE ──────────>│
     │                                   │  (n8n Webhook trigger)   │
     │                                   │                          │ Tạo tài khoản lương
     │                                   │                          │ cho nhân viên mới
     │                                   │                          │ trong DB của Finance
```

### 6.4. Cấu trúc Event chuẩn (Event Schema)

Mọi Event phát ra phải tuân thủ cấu trúc sau để đảm bảo Plugin B có đủ thông tin xử lý:

```json
{
  "event_id": "uuid-v4",
  "event_type": "hr.employee.created",
  "tenant_id": "uuid-truong-a",
  "plugin_source": "hr-module",
  "created_at": "2026-08-05T15:00:00Z",
  "payload": {
    "employee_id": "uuid-v4",
    "full_name": "Nguyễn Văn A",
    "department": "Kế toán",
    "hire_date": "2026-08-05",
    "position": "Kế toán viên"
  }
}
```

> [!IMPORTANT]
> **`tenant_id` là trường bắt buộc trong mọi Event.** Plugin B phải kiểm tra `tenant_id` trước khi xử lý để đảm bảo không xử lý nhầm dữ liệu của Tenant khác (đặc biệt quan trọng vì Redis Pub/Sub là shared channel).

### 6.5. Quy tắc đặt tên Event (Event Naming Convention)

```
{plugin_code_name}.{resource}.{action_past_tense}
```

| Event Type | Ý nghĩa |
|---|---|
| `hr.employee.created` | HR Module vừa tạo nhân viên mới |
| `hr.employee.deactivated` | HR Module vừa vô hiệu hóa nhân viên |
| `hr.leave_request.approved` | Đơn nghỉ phép vừa được duyệt |
| `finance.payroll.processed` | Finance vừa xử lý xong bảng lương |
| `core.plugin.installed` | Một Plugin vừa được cài đặt thành công |

### 6.6. Ví dụ End-to-End: HR → Finance

**Kịch bản:** Nhân viên mới vào làm, HR tạo hồ sơ → Finance tự động tạo tài khoản lương.

```
[Bước 1] Admin HR tạo nhân viên mới trên Appsmith UI
         ↓
[Bước 2] n8n Workflow của HR Module INSERT vào bảng hr_employees
         ↓
[Bước 3] n8n Workflow PUBLISH event lên Redis:
         Channel: "proteus.events.hr"
         Event: { event_type: "hr.employee.created", tenant_id: "...", payload: {...} }
         ↓
[Bước 4] n8n Workflow của Finance Module đang SUBSCRIBE channel "proteus.events.hr"
         → Nhận được event "hr.employee.created"
         ↓
[Bước 5] Finance Workflow kiểm tra tenant_id, lọc đúng dữ liệu
         → INSERT vào bảng finance_accounts: tạo tài khoản lương cho nhân viên
         → Gửi thông báo Mattermost: "✅ Đã tạo tài khoản lương cho Nguyễn Văn A"
         ↓
[Kết quả] HR không cần làm thêm bất kỳ thao tác nào. Finance tự động chạy.
```

### 6.7. Bảng tổng hợp: Làm gì và Không làm gì

| Tình huống | Đúng ✅ | Sai ❌ |
|---|---|---|
| Finance cần dữ liệu nhân viên | Subscribe event `hr.employee.created` | `SELECT * FROM hr_employees` từ Finance code |
| Plugin cần thông báo Plugin khác | PUBLISH event lên Redis | Gọi trực tiếp API nội bộ của Plugin khác |
| Xử lý sự kiện đa Tenant | Luôn filter theo `tenant_id` trong event payload | Xử lý tất cả events không phân biệt Tenant |
| Plugin A phụ thuộc Plugin B | Khai báo dependency trong `manifest.yaml` | Hard-code import code của Plugin B |

### 6.8. Khai báo Dependency trong manifest.yaml

Nếu Finance Plugin cần nhận Events từ HR Plugin, điều này phải được khai báo rõ ràng trong `manifest.yaml` của Finance:

```yaml
# plugins/finance-module/manifest.yaml
name: finance-module
version: "1.0.0"

event_subscriptions:
  - source_plugin: hr-module
    event_types:
      - hr.employee.created
      - hr.employee.deactivated
      - hr.leave_request.approved
    handler_workflow: finance_sync_workflow.json
```

Plugin Manager sẽ đọc `event_subscriptions` và tự động cấu hình n8n để Finance Workflow lắng nghe đúng các event từ HR. Nếu HR Module chưa được cài đặt, Plugin Manager sẽ **cảnh báo dependency** nhưng vẫn cho phép cài (các subscription sẽ được kích hoạt sau khi HR được cài xong).

---

## 7. Tổng kết

Proteus OS sinh ra để đập tan tình trạng "ốc đảo thông tin" (mỗi phòng ban dùng một phần mềm rời rạc). Nó biến hệ thống quản trị của bất kỳ tổ chức nào thành một thể thống nhất, **dễ cài đặt như tải App trên điện thoại**, **bảo mật như ngân hàng** (nhờ cô lập chung cư Multi-tenancy), và **cực kỳ thông minh** nhờ AI trực tiếp điều hành công việc.

