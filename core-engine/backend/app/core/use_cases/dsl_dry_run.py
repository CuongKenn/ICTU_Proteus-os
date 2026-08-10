# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — DSL Dry Run Engine
# Chạy preview các hành động (write/critical) trước khi phê duyệt.
# Tham chiếu: docs/dsl-spec.md §2, §6

import logging
from typing import Any, Dict

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class DSLDryRunEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def execute_dry_run(
        self, tenant_id: str, dsl_payload: dict
    ) -> Dict[str, Any]:
        """
        Thực hiện dry run cho lệnh DSL (effect=write/critical).
        Truy vấn DB lấy affected_count và preview (3-5 bản ghi)
        KHÔNG ĐƯỢC làm thay đổi dữ liệu (chỉ SELECT).
        """
        effect = dsl_payload.get("effect", "read")

        # Chỉ áp dụng cho write/critical
        if effect not in ["write", "critical"]:
            return {
                "affected_count": 0,
                "preview": [],
                "message": "Dry run skipped for read effect.",
            }

        action = dsl_payload.get("action", "")
        # Phân tích action: vd "hr.leave_requests.batch_approve" -> table "hr_leave_requests"
        # Trong thực tế, cần Mapping từ DSL action sang schema/query cụ thể
        # Ở đây mock logic lấy table và filter
        target_table = "hr_leave_requests" if "hr" in action else None

        if not target_table:
            # Fallback mock nếu không parse được
            return {
                "affected_count": 5,
                "preview": [{"mock": "data", "reason": "No target table mapped"}],
                "message": "Cảnh báo: Không thể map target_table cho dry_run.",
            }

        try:
            # Kiểm tra xem table có tồn tại không
            check_table = await self.db.execute(
                text(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :table_name)"
                ),
                {"table_name": target_table},
            )
            if not check_table.scalar():
                return {
                    "affected_count": 0,
                    "preview": [],
                    "message": "Không có bản ghi bị ảnh hưởng (Bảng không tồn tại)",
                }

            # Lấy số lượng bị ảnh hưởng
            # Tuỳ theo DSL conditions, ở đây query mock
            sql_count = text(
                f"SELECT COUNT(*) FROM {target_table} WHERE tenant_id = :tenant_id AND status = 'pending'"
            )
            count_res = await self.db.execute(sql_count, {"tenant_id": tenant_id})
            affected_count = count_res.scalar() or 0

            if affected_count == 0:
                return {
                    "affected_count": 0,
                    "preview": [],
                    "message": "Không có bản ghi bị ảnh hưởng.",
                }

            # Lấy preview (limit 3)
            sql_preview = text(
                f"SELECT * FROM {target_table} WHERE tenant_id = :tenant_id AND status = 'pending' LIMIT 3"
            )
            preview_res = await self.db.execute(sql_preview, {"tenant_id": tenant_id})
            # Convert record to dict (Mock columns)
            cols = preview_res.keys()
            preview = [dict(zip(cols, row)) for row in preview_res.fetchall()]

            # Đảm bảo datetime etc convertable sang JSON
            for record in preview:
                for key, val in record.items():
                    if hasattr(val, "isoformat"):
                        record[key] = val.isoformat()

            return {
                "affected_count": affected_count,
                "preview": preview,
                "message": f"Sẽ ảnh hưởng {affected_count} bản ghi.",
            }

        except Exception as e:
            logger.error(f"[Dry Run] Lỗi khi thực thi: {e}")
            return {
                "affected_count": 0,
                "preview": [],
                "error": str(e),
                "message": "Có lỗi khi chạy preview.",
            }

    def format_mattermost_message(self, dry_run_result: dict, action: str) -> str:
        """
        Đưa kết quả dry run vào Mattermost approval message.
        """
        count = dry_run_result.get("affected_count", 0)

        if count == 0:
            return f"⚠️ **Cảnh báo:** Lệnh `{action}` không có bản ghi nào bị ảnh hưởng. Hãy kiểm tra lại."

        preview_text = ""
        for p in dry_run_result.get("preview", []):
            preview_text += f"- {str(p)}\n"

        return (
            f"🔍 **Dry Run Preview:**\n"
            f"Lệnh `{action}` sẽ ảnh hưởng đến **{count}** bản ghi.\n"
            f"**Preview (tối đa 3 bản ghi đầu):**\n"
            f"{preview_text}"
        )
