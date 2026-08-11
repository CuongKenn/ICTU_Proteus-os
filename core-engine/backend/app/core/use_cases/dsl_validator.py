# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — DSL Validator Engine
# Xác thực 5 quy tắc trước khi chạy AI Command theo dsl-spec.md §6.

import json
from typing import Any, Dict

import jsonschema

from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import PluginStatus
from app.core.formal_verification import Z3FormalVerifier, Z3VerificationError


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
    def __init__(
        self, plugin_repo: AbstractPluginRepository, tenant_id: str, user_id: str
    ):
        """
        Khởi tạo Validator với Plugin Repository để kiểm tra DB constraint.
        """
        self.plugin_repo = plugin_repo
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
            status = await self.plugin_repo.get_tenant_plugin_status_by_code(
                tenant_id=self.tenant_id, plugin_code=plugin_code
            )
            if not status or status.value != "ACTIVE":
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

        # Rule 6: Mathematical & Logical Invariant Verification (Formal Verification)
        try:
            verifier = Z3FormalVerifier(tenant_id=self.tenant_id, user_id=self.user_id)
            verifier.verify_dsl(dsl_payload)
        except Z3VerificationError as e:
            raise DSLInvalidParametersError(str(e))

        return True
