# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Use Case — Generic Plugin Action Dispatcher
#
# Cho phép Micro-UI gọi N workflow webhook của plugin qua MỘT endpoint duy nhất:
#   POST /api/v1/plugins/{code}/actions/{action}  {payload}
# mà core backend không cần thêm endpoint riêng cho từng plugin
# (giữ tính isolated: logic nghiệp vụ nằm trong plugins/<code>/workflows/*.json).
#
# Luồng loose coupling:
#   UI --(action name)--> Use Case --(Port)--> N8nAdapter --(webhook URL)--> n8n
# UI không biết webhook URL, không biết n8n. Thay engine khác chỉ cần
# adapter mới implement cùng cách resolve action → URL.

from __future__ import annotations

import json
import logging
import re
import uuid
from pathlib import Path
from typing import Any

from app.adapters.external.n8n_adapter import N8nAdapter, N8nAdapterError
from app.adapters.repositories.base import AbstractPluginRepository
from app.adapters.repositories.role_repo import RoleRepository
from app.core.domain.entities import PluginStatus, TenantContext
from app.core.domain.exceptions import (
    DSLInvalidActionError,
    DSLInvalidParametersError,
    DSLPluginNotActiveError,
    InsufficientPermissionsError,
    PluginNotFoundError,
)
from app.core.domain.permissions import has_admin_role, has_wildcard_permission
from app.core.domain.ports import AbstractManifestParserPort
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)

_ACTION_PATTERN = re.compile(r"^[a-z0-9_-]+$")
_CODE_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
_MAX_PAYLOAD_BYTES = 100 * 1024  # Chặn payload quá lớn gửi sang n8n


class PluginActionUseCase:
    """
    Dispatcher generic cho workflow actions của plugin.

    Không chứa logic nghiệp vụ của bất kỳ plugin cụ thể nào:
    mọi thứ (allowlist action, webhook path, quyền) đều suy ra từ
    manifest.yaml + roles của plugin đó.
    """

    def __init__(
        self,
        plugin_repo: AbstractPluginRepository,
        manifest_parser: AbstractManifestParserPort,
        n8n_adapter: N8nAdapter,
        role_repo: RoleRepository,
    ) -> None:
        self.plugin_repo = plugin_repo
        self.manifest_parser = manifest_parser
        self.n8n_adapter = n8n_adapter
        self.role_repo = role_repo

    # ─── Helpers ──────────────────────────────────────────────

    def _resolve_workflow(self, plugin_code: str, action: str) -> tuple[Any, str]:
        """
        Trả về (workflow_entry, action_id hiệu dụng).
        Match theo `workflows[].id`, fallback sang stem của `file`
        cho manifest cũ chưa khai báo id.
        """
        from app.adapters.external.local_manifest_parser import ManifestParserError

        try:
            manifest = self.manifest_parser.parse(plugin_code)
        except ManifestParserError as exc:
            raise PluginNotFoundError(
                f"Plugin '{plugin_code}' không tồn tại."
            ) from exc

        for wf in manifest.workflows:
            effective_id = wf.id or Path(wf.file).stem
            if effective_id == action:
                return wf, effective_id
        raise DSLInvalidActionError(
            f"Action '{action}' không thuộc plugin '{plugin_code}'. "
            f"Xem GET /plugins/{plugin_code}/actions để lấy danh sách."
        )

    async def _require_active_installation(
        self, ctx: TenantContext, plugin_code: str
    ) -> None:
        plugin = await self.plugin_repo.get_by_code_name(plugin_code)
        if not plugin:
            raise PluginNotFoundError(f"Plugin '{plugin_code}' không tồn tại.")
        status = await self.plugin_repo.get_installation_status(
            ctx.tenant_id, plugin.id
        )
        if status != PluginStatus.ACTIVE:
            raise DSLPluginNotActiveError(
                f"Plugin '{plugin_code}' chưa được cài đặt hoặc không ACTIVE "
                f"(trạng thái hiện tại: {status})."
            )

    async def _require_action_permission(
        self, ctx: TenantContext, plugin_code: str, action: str
    ) -> None:
        # Admin bypass (đồng nhất với require_permission trong dependencies).
        if has_admin_role(ctx.roles):
            return
        # Quyền suy ra theo convention prefix của plugin:
        # asset-module → mọi permission bắt đầu "asset:".
        prefix = plugin_code.split("-")[0] + ":"
        perms = await self.role_repo.get_user_permissions(ctx.user_id)
        if has_wildcard_permission(perms):
            return
        if not any(p.startswith(prefix) for p in perms):
            raise InsufficientPermissionsError(
                f"Cần quyền thuộc nhóm '{prefix}*' để gọi action '{action}'."
            )

    def _resolve_webhook_url(self, plugin_code: str, wf: Any) -> str:
        """Đọc workflow JSON, lấy webhook node path → dựng URL n8n."""
        plugins_dir = self.manifest_parser.plugins_dir
        wf_path = plugins_dir / plugin_code / wf.file
        if not wf_path.exists():
            raise DSLInvalidParametersError(
                f"File workflow '{wf.file}' của action không tồn tại."
            )
        try:
            with open(wf_path, encoding="utf-8-sig") as f:
                wf_json = json.load(f)
        except (json.JSONDecodeError, OSError) as exc:
            raise DSLInvalidParametersError(
                f"File workflow '{wf.file}' không đọc được: {exc}"
            ) from exc

        path = None
        for node in wf_json.get("nodes", []):
            if node.get("type") == "n8n-nodes-base.webhook":
                path = (node.get("parameters", {}) or {}).get("path")
                if path:
                    break
        if not path:
            raise DSLInvalidParametersError(
                f"Workflow '{wf.file}' không có webhook node — "
                f"chỉ workflow trigger='webhook' mới gọi được qua API."
            )
        base = settings.N8N_URL.rstrip("/")
        return f"{base}/webhook/{str(path).lstrip('/')}"

    # ─── Public API ───────────────────────────────────────────

    async def list_actions(
        self, ctx: TenantContext, plugin_code: str
    ) -> list[dict[str, Any]]:
        """Liệt kê các webhook actions UI có thể gọi (để render nút động)."""
        if not _CODE_PATTERN.match(plugin_code):
            raise PluginNotFoundError(f"Plugin '{plugin_code}' không tồn tại.")
        from app.adapters.external.local_manifest_parser import ManifestParserError

        try:
            manifest = self.manifest_parser.parse(plugin_code)
        except ManifestParserError as exc:
            raise PluginNotFoundError(
                f"Plugin '{plugin_code}' không tồn tại."
            ) from exc

        return [
            {
                "action": wf.id or Path(wf.file).stem,
                "name": wf.name,
                "description": wf.description,
                "trigger": wf.trigger,
            }
            for wf in manifest.workflows
            if wf.trigger == "webhook"
        ]

    async def execute(
        self,
        ctx: TenantContext,
        plugin_code: str,
        action: str,
        payload: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """
        Dispatch 1 action → n8n webhook. Trả về {task_id, action, result}.
        Lỗi n8n (down/timeout/5xx) được propagate dưới dạng N8nAdapterError
        để tầng Entrypoint map sang 502 (không nuốt thành 400).
        """
        if not _CODE_PATTERN.match(plugin_code):
            raise PluginNotFoundError(f"Plugin '{plugin_code}' không tồn tại.")
        if not _ACTION_PATTERN.match(action):
            raise DSLInvalidActionError(f"Action '{action}' không hợp lệ.")
        if not isinstance(payload, dict):
            raise DSLInvalidParametersError("Payload phải là một JSON object.")
        if len(json.dumps(payload, default=str)) > _MAX_PAYLOAD_BYTES:
            raise DSLInvalidParametersError(
                f"Payload vượt quá {_MAX_PAYLOAD_BYTES // 1024}KB."
            )

        wf, _ = self._resolve_workflow(plugin_code, action)
        if wf.trigger != "webhook":
            raise DSLInvalidParametersError(
                f"Action '{action}' có trigger='{wf.trigger}' — "
                f"chỉ workflow webhook mới gọi được qua API "
                f"(cron chạy theo lịch, manual chạy bởi admin/AI)."
            )

        await self._require_active_installation(ctx, plugin_code)
        await self._require_action_permission(ctx, plugin_code, action)
        webhook_url = self._resolve_webhook_url(plugin_code, wf)

        task_id = idempotency_key or str(uuid.uuid4())
        # Body PHẲNG (flat): business fields của payload nằm top-level để tương
        # thích với expression sẵn có trong workflow ($json.body.asset_type…).
        # Các trường server-owned spread SAU để chống giả mạo tenant/user.
        envelope = {
            **payload,
            "tenant_id": str(ctx.tenant_id),
            "user_id": str(ctx.user_id),
            "plugin": plugin_code,
            "action": action,
            "idempotency_key": task_id,
        }
        logger.info(
            "Dispatching plugin action",
            extra={
                "plugin": plugin_code,
                "action": action,
                "tenant_id": str(ctx.tenant_id),
                "task_id": task_id,
            },
        )
        result = await self.n8n_adapter.trigger_webhook(webhook_url, envelope)
        return {"task_id": task_id, "action": action, "result": result}
