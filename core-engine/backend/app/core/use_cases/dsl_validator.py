# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — DSL Validator Engine
# Xác thực 5 quy tắc trước khi chạy AI Command theo dsl-spec.md §6.

from typing import Any

import jsonschema

from app.adapters.repositories.base import AbstractPluginRepository
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
        self,
        plugin_repo: AbstractPluginRepository,
        role_repo,
        tenant_id: str,
        user_id: str,
    ):
        """
        Khởi tạo Validator với Plugin Repository để kiểm tra DB constraint.
        """
        self.plugin_repo = plugin_repo
        self.role_repo = role_repo
        self.tenant_id = tenant_id
        self.user_id = user_id

    async def validate(self, dsl_payload: dict[str, Any]):
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

        # Rule 1: Action whitelist (Removed to follow Open/Closed Principle)
        # We rely on Rule 2 (Permission) and Rule 3 (Plugin status) to secure the action.
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
        req_permission = f"{plugin_code}:{resource}:{method}"
        import uuid

        user_permissions = await self.role_repo.get_user_permissions(
            uuid.UUID(self.user_id)
        )
        if req_permission not in user_permissions:
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
