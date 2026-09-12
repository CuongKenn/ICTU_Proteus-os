# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Role Templates theo loại tổ chức.
# Tenant admin chọn 1 template lúc setup thay vì ráp tay từng role
# từ 9 plugin. Áp dụng idempotent: role đã tồn tại thì bỏ qua.

from __future__ import annotations

TEMPLATES: dict[str, dict] = {
    "sme": {
        "key": "sme",
        "name": "Công ty SME",
        "description": "Doanh nghiệp vừa và nhỏ: gọn nhẹ, kiêm nhiệm.",
        "roles": [
            {
                "name": "general_manager",
                "display_name": "Ban Giám đốc",
                "description": "Toàn quyền điều hành",
                "permissions": ["*"],
            },
            {
                "name": "hr_officer",
                "display_name": "Nhân sự",
                "description": "Hồ sơ, nghỉ phép, tuyển dụng",
                "permissions": [
                    "hr:employees:read",
                    "hr:employees:write",
                    "hr:leave_requests:read",
                    "hr:leave_requests:approve",
                    "hr:applications:read",
                    "hr:applications:write",
                    "hr:reports:read",
                ],
            },
            {
                "name": "accountant",
                "display_name": "Kế toán",
                "description": "Thu chi, hóa đơn, đề xuất",
                "permissions": [
                    "finance:transactions:read",
                    "finance:transactions:write",
                    "finance:invoices:read",
                    "finance:invoices:write",
                    "finance:reports:read",
                ],
            },
            {
                "name": "sales_rep",
                "display_name": "Kinh doanh",
                "description": "Lead, cơ hội, khách hàng",
                "permissions": [
                    "crm:leads:read",
                    "crm:leads:write",
                    "crm:opportunities:read",
                    "crm:opportunities:write",
                    "crm:customers:read",
                ],
            },
            {
                "name": "staff",
                "display_name": "Nhân viên",
                "description": "Quyền cơ bản mọi nhân viên",
                "permissions": [
                    "hr:leave_requests:read",
                    "asset:items:read",
                    "asset:requests:write",
                    "crm:customers:read",
                ],
            },
        ],
    },
    "school": {
        "key": "school",
        "name": "Trường học",
        "description": "Ban giám hiệu, giáo vụ, giáo viên.",
        "roles": [
            {
                "name": "principal",
                "display_name": "Ban Giám hiệu",
                "description": "Toàn quyền quản trị trường",
                "permissions": ["*"],
            },
            {
                "name": "academic_officer",
                "display_name": "Giáo vụ",
                "description": "Hồ sơ, văn bản, lịch họp",
                "permissions": [
                    "hr:employees:read",
                    "document:incoming:read",
                    "document:incoming:write",
                    "document:outgoing:write",
                    "meeting:bookings:write",
                ],
            },
            {
                "name": "teacher",
                "display_name": "Giáo viên",
                "description": "Giảng dạy, tài sản lớp học",
                "permissions": [
                    "asset:items:read",
                    "asset:requests:write",
                    "meeting:bookings:read",
                ],
            },
            {
                "name": "it_support",
                "display_name": "CNTT",
                "description": "Thiết bị, ticket nội bộ",
                "permissions": [
                    "asset:items:read",
                    "asset:items:write",
                    "it:tickets:read",
                    "it:tickets:write",
                ],
            },
        ],
    },
    "government": {
        "key": "government",
        "name": "Cơ quan hành chính",
        "description": "Văn thư, lãnh đạo, chuyên viên.",
        "roles": [
            {
                "name": "director",
                "display_name": "Lãnh đạo",
                "description": "Phê duyệt, toàn quyền xem",
                "permissions": ["*"],
            },
            {
                "name": "clerk",
                "display_name": "Văn thư",
                "description": "Tiếp nhận, ban hành văn bản",
                "permissions": [
                    "document:incoming:read",
                    "document:incoming:write",
                    "document:outgoing:write",
                    "document:approvals:read",
                ],
            },
            {
                "name": "specialist",
                "display_name": "Chuyên viên",
                "description": "Xử lý công việc, dự án",
                "permissions": [
                    "project:tasks:read",
                    "project:tasks:write",
                    "document:incoming:read",
                    "meeting:bookings:read",
                ],
            },
            {
                "name": "procurement_officer",
                "display_name": "Mua sắm",
                "description": "Đề xuất, hợp đồng",
                "permissions": [
                    "procurement:requests:read",
                    "procurement:requests:write",
                    "procurement:contracts:read",
                ],
            },
        ],
    },
}


def list_templates() -> list[dict]:
    """Tóm tắt các template (không kèm permissions chi tiết)."""
    return [
        {
            "key": t["key"],
            "name": t["name"],
            "description": t["description"],
            "roles_count": len(t["roles"]),
        }
        for t in TEMPLATES.values()
    ]


def get_template(key: str) -> dict | None:
    return TEMPLATES.get(key)
