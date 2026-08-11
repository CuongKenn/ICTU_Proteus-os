# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — DSL Dry Run Engine
# Chạy preview các hành động (write/critical) trước khi phê duyệt.
# Tham chiếu: docs/dsl-spec.md §2, §6

import logging
from typing import Any

from app.adapters.repositories.base import AbstractDSLDryRunRepository

logger = logging.getLogger(__name__)


class DSLDryRunEngine:
    def __init__(self, dry_run_repo: AbstractDSLDryRunRepository):
        self.dry_run_repo = dry_run_repo

    async def execute_dry_run(
        self, tenant_id: str, dsl_payload: dict
    ) -> dict[str, Any]:
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
        # Phân tích action: vd "hr.leave_requests.batch_approve"
        # -> table "hr_leave_requests"
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
            res = await self.dry_run_repo.execute_dry_run(tenant_id, target_table)
            affected_count = res.get("affected_count", 0)
            preview = res.get("preview", [])

            if affected_count == 0:
                return {
                    "affected_count": 0,
                    "preview": [],
                    "message": (
                        "Không có bản ghi bị ảnh hưởng " "(hoặc bảng không tồn tại)."
                    ),
                }

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
            return (
                f"⚠️ **Cảnh báo:** Lệnh `{action}` không có bản "
                f"ghi nào bị ảnh hưởng. Hãy kiểm tra lại."
            )

        preview_text = ""
        for p in dry_run_result.get("preview", []):
            preview_text += f"- {str(p)}\n"

        return (
            f"🔍 **Dry Run Preview:**\n"
            f"Lệnh `{action}` sẽ ảnh hưởng đến **{count}** bản ghi.\n"
            f"**Preview (tối đa 3 bản ghi đầu):**\n"
            f"{preview_text}"
        )
