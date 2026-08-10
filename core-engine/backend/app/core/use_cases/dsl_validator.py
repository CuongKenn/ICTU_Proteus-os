# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — DSL Validator Engine
# Xác thực 5 quy tắc trước khi chạy AI Command theo dsl-spec.md §6.

import json
from typing import Any, Dict
import jsonschema


class DSLValidationError(Exception):
    pass


class DSLInvalidActionError(DSLValidationError):
    pass


class DSLPermissionDeniedError(DSLValidationError):
    pass


class DSLPluginNotActiveError(DSLValidationError):
    pass


class DSLInvalidParametersError(DSLValidationError):
    pass


class DSLVersionCompatError(DSLValidationError):
    pass


class DSLValidator:
    def __init__(self, db_session, tenant_id: str, user_id: str):
        """
        Khởi tạo Validator với session database để kiểm tra DB constraint.
        """
        self.db = db_session
        self.tenant_id = tenant_id
        self.user_id = user_id

    async def validate(self, dsl_payload: Dict[str, Any]):
        """
        Kiểm tra 5 quy tắc theo đặc tả DSL.
        """
        # Rule 5: Version compat
        version = dsl_payload.get("version")
        if version != "1.0":
            raise DSLVersionCompatError(
                f"Unsupported DSL version: {version}. Expected 1.0."
            )

        # Parse action structure: e.g. "hr.leave_requests.batch_approve"
        action = dsl_payload.get("action", "")
        parts = action.split(".")
        if len(parts) < 3:
            raise DSLInvalidActionError(
                f"Invalid action format: {action}. Expected plugin.resource.method"
            )

        plugin_code = parts[0]
        resource = parts[1]
        method = parts[2]

        # Rule 1: Action whitelist (Mock)
        # Thực tế cần lấy danh sách whitelist từ Registry
        whitelist_actions = [
            "hr.leave_requests.batch_approve",
            "hr.employees.get",
            "finance.invoices.create",
            "core.users.invite",
        ]
        if action not in whitelist_actions:
            raise DSLInvalidActionError(f"Action not in whitelist: {action}")

        # Rule 3: Plugin installed + ACTIVE
        if plugin_code != "core":
            from sqlalchemy import text

            sql = text("""
                SELECT status FROM tenant_plugins tp
                JOIN plugins p ON p.id = tp.plugin_id
                WHERE tp.tenant_id = :tenant AND p.code_name = :plugin
            """)
            res = await self.db.execute(
                sql, {"tenant": self.tenant_id, "plugin": plugin_code}
            )
            row = res.fetchone()
            if not row or row.status != "ACTIVE":
                raise DSLPluginNotActiveError(
                    f"Plugin {plugin_code} is not installed or not ACTIVE."
                )

        # Rule 2: Permission check
        # Thực tế cần join roles, user_roles
        # Ở đây giả lập luôn pass hoặc check cơ bản
        req_permission = f"{plugin_code}:{resource}:{method}"
        # mock permission check logic
        has_permission = True  # Giả sử pass
        if not has_permission:
            raise DSLPermissionDeniedError(
                f"User {self.user_id} lacks permission {req_permission}"
            )

        # Rule 4: Parameters JSON Schema
        params = dsl_payload.get("parameters", {})
        # Giả lập Schema đơn giản dựa vào action
        # Thực tế Schema lưu trong DB hoặc Manifest của Plugin
        schema = {"type": "object", "properties": {}, "additionalProperties": True}

        if action == "hr.leave_requests.batch_approve":
            schema = {
                "type": "object",
                "properties": {
                    "request_ids": {"type": "array", "items": {"type": "string"}},
                    "reason": {"type": "string"},
                },
                "required": ["request_ids"],
            }

        try:
            jsonschema.validate(instance=params, schema=schema)
        except jsonschema.exceptions.ValidationError as e:
            raise DSLInvalidParametersError(f"Parameter validation failed: {e.message}")

        return True
