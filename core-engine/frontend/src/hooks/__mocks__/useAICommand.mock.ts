// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

// Helper: dùng fallback khi chạy trên HTTP không có crypto.randomUUID
const uuid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const MOCK_RESPONSES = {
  read: {
    status: "completed" as const,
    message: "Đã xử lý thành công",
    result:
      "📊 **Báo cáo tuần này (04/08 – 10/08/2026):**\n- Tổng đơn nghỉ phép: **15**\n- Đã duyệt: **8** ✅\n- Đang chờ: **5** ⏳\n- Bị từ chối: **2** ❌",
  },
  write: {
    status: "pending_approval" as const,
    message: "Lệnh cần phê duyệt từ Ban Giám đốc",
    dsl_preview: {
      command_id: uuid(),
      action: "hr.leave_requests.batch_approve",
      effect: "write" as const,
      approval_message:
        "⚠️ Tôi chuẩn bị DUYỆT 5 đơn nghỉ phép đang chờ xử lý. Vui lòng xác nhận trên Mattermost.",
      dry_run_result: {
        affected_count: 5,
        preview: [
          { employee_name: "Nguyễn Văn A", days: 2, type: "annual" },
          { employee_name: "Trần Thị B", days: 1, type: "sick" },
          { employee_name: "Lê Hoàng C", days: 3, type: "annual" },
        ],
      },
      approval_deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    },
  },
};

export function detectEffectFromInput(input: string): "read" | "write" {
  const writeKeywords = ["duyệt", "phê duyệt", "xóa", "chỉnh sửa", "cài đặt", "gỡ", "tắt", "bật", "approve"];
  const lower = input.toLowerCase();
  return writeKeywords.some((kw) => lower.includes(kw)) ? "write" : "read";
}
