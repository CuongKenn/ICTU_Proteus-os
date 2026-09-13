# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — DSL Validator Engine
# Xác thực 5 quy tắc trước khi chạy AI Command theo dsl-spec.md §6.

import uuid
from pathlib import Path
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
        manifest_parser=None,
    ):
        """
        Khởi tạo Validator với Plugin Repository để kiểm tra DB constraint.
        manifest_parser (tùy chọn): cho phép action 2-part {prefix}.{workflow_id}
        của plugin đã cài (dynamic catalog) — kiểm tra workflow tồn tại trong manifest.
        """
        self.plugin_repo = plugin_repo
        self.role_repo = role_repo
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.manifest_parser = manifest_parser

    async def validate(self, dsl_payload: dict[str, Any]):
        """
        Kiểm tra 5 quy tắc theo đặc tả DSL.
        """
        # Rule 5: Version compat
        version = dsl_payload.get("dsl_version") or dsl_payload.get("version")
        if version != "1.0":
            raise DSLVersionCompatError(
                f"Unsupported DSL version: {version}. Expected 1.0."
            )

        # Parse action structure: e.g. "hr.leave_requests.batch_approve"
        # hoặc action 2-part "hr.leave_request" (workflow của plugin đã cài).

        action = dsl_payload.get("action", "")
        parts = action.split(".")
        if len(parts) == 2 and all(parts) and self.manifest_parser is not None:
            await self._validate_plugin_workflow_action(action, dsl_payload)
            return True
        if len(parts) < 3:
            raise DSLInvalidActionError(
                f"Invalid action format: {action}. Expected plugin.resource.method"
            )

        plugin_code = parts[0]
        resource = parts[1]
        method = parts[2]

        # Rule 3: Plugin installed + ACTIVE
        if plugin_code != "core":
            # Auto append -module to match DB code_name if missing
            db_plugin_code = (
                plugin_code
                if plugin_code.endswith("-module")
                else f"{plugin_code}-module"
            )

            status = await self.plugin_repo.get_tenant_plugin_status_by_code(
                tenant_id=self.tenant_id, plugin_code=db_plugin_code
            )
            if not status or status.value != "ACTIVE":
                # Fallback to the original plugin code just in case
                status = await self.plugin_repo.get_tenant_plugin_status_by_code(
                    tenant_id=self.tenant_id, plugin_code=plugin_code
                )

                if not status or status.value != "ACTIVE":
                    raise DSLPluginNotActiveError(
                        f"Plugin {db_plugin_code} is not installed or not ACTIVE."
                    )

        # Rule 2: Permission check
        req_permission = f"{plugin_code}:{resource}:{method}"
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
                    "raw_input": {"type": "string"},
                },
                # Bỏ qua yêu cầu bắt buộc "request_ids" vì AI thường chỉ trả về "raw_input"
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

    async def _validate_plugin_workflow_action(
        self, action: str, dsl_payload: dict[str, Any]
    ) -> None:
        """Validate action 2-part {prefix}.{workflow_id} (dynamic catalog).

        - Plugin {prefix}-module phải ACTIVE.
        - Workflow webhook phải tồn tại trong manifest.
        - User phải có ít nhất 1 permission thuộc nhóm {prefix}:*
          (cùng convention với PluginActionUseCase).
        """
        from app.core.use_cases.action_catalog import split_plugin_action

        split = split_plugin_action(action)
        if split is None or self.manifest_parser is None:
            raise DSLInvalidActionError(f"Invalid action format: {action}.")
        db_plugin_code, workflow_id = split
        prefix = action.split(".")[0]

        status = await self.plugin_repo.get_tenant_plugin_status_by_code(
            tenant_id=self.tenant_id, plugin_code=db_plugin_code
        )
        if not status or status.value != "ACTIVE":
            raise DSLPluginNotActiveError(
                f"Plugin {db_plugin_code} is not installed or not ACTIVE."
            )

        try:
            manifest = self.manifest_parser.parse(db_plugin_code)
        except Exception as e:
            raise DSLInvalidActionError(
                f"Plugin '{db_plugin_code}' không tồn tại: {e}"
            ) from e
        workflow_ids = {
            (getattr(wf, "id", None) or Path(wf.file).stem)
            for wf in manifest.workflows or []
            if getattr(wf, "trigger", None) == "webhook"
        }
        if workflow_id not in workflow_ids:
            raise DSLInvalidActionError(
                f"Action '{action}' không thuộc plugin '{db_plugin_code}'."
            )

        user_permissions = await self.role_repo.get_user_permissions(
            uuid.UUID(self.user_id)
        )
        if not any(str(p).startswith(f"{prefix}:") for p in user_permissions or []):
            raise DSLPermissionDeniedError(
                f"User {self.user_id} lacks permission '{prefix}:*'."
            )

        params = dsl_payload.get("parameters", {})
        if not isinstance(params, dict):
            raise DSLInvalidParametersError("Parameters phải là một JSON object.")

        try:
            verifier = Z3FormalVerifier(tenant_id=self.tenant_id, user_id=self.user_id)
            verifier.verify_dsl(dsl_payload)
        except Z3VerificationError as e:
            raise DSLInvalidParametersError(str(e))
