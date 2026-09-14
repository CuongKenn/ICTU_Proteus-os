# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Dynamic DX-DSL Action Catalog.
# Dựng danh sách actions AI được phép gọi từ:
#   1. Core actions tĩnh (docs/dsl-spec.md §3.1), và
#   2. Workflows trigger=webhook của các plugin tenant đã cài (ACTIVE).
# Effect là heuristic theo tên action (list/get/read/search/summary/report → read,
# còn lại → write) vì manifest v1 chưa khai báo effect — hiển thị rõ cho LLM
# là "gợi ý", quyết định cuối thuộc về DSLValidator + Human-in-the-loop.

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_ACTION_SEGMENT_PATTERN = re.compile(r"^[a-z0-9_-]+$")
_PLUGIN_CODE_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def _ensure_inside_plugins_dir(plugins_dir: Path, target: Path) -> Path:
    """Resolve + chặn path traversal (../) — raise ValueError nếu vượt ngoài."""
    base = plugins_dir.resolve()
    resolved = (base / target).resolve() if not target.is_absolute() else target.resolve()
    try:
        _inside = resolved.is_relative_to(base)
    except AttributeError:  # Python < 3.9
        _inside = base in resolved.parents or resolved == base
    if not _inside:
        raise ValueError(f"Path vượt ngoài plugins_dir: {target}")
    return resolved

READ_HINTS = (
    "list",
    "get",
    "read",
    "search",
    "summary",
    "report",
    "balance",
    "check",
    "overview",
    "metrics",
)


@dataclass
class CatalogAction:
    action: str
    effect_hint: str
    description: str


CORE_ACTIONS: list[CatalogAction] = [
    CatalogAction(
        "core.chat.reply",
        "read",
        "Trả lời chào hỏi / câu chuyện ngoài nghiệp vụ. Không chạm dữ liệu.",
    ),
    CatalogAction("core.plugins.list", "read", "Liệt kê plugin đã cài của tổ chức."),
    CatalogAction(
        "core.plugins.install", "write", "Cài plugin mới (cần tenant_admin)."
    ),
    CatalogAction("core.users.list", "read", "Liệt kê người dùng trong tenant."),
    CatalogAction(
        "core.users.deactivate", "critical", "Vô hiệu hóa tài khoản (2 duyệt)."
    ),
    CatalogAction(
        "core.knowledge.search", "read", "Tìm kiếm tri thức nội bộ (RAG, có trích dẫn)."
    ),
    CatalogAction(
        "core.knowledge.ingest", "write", "Nạp tài liệu mới vào RAG."
    ),
]

# Core read actions mở cho MỌI role đã đăng nhập (docs/dsl-spec.md §3.1,
# clarification §9 RAG Assistant): chỉ đọc dữ liệu tenant mình, không duyệt.
CORE_PUBLIC_READ_ACTIONS: frozenset[str] = frozenset(
    {
        "core.chat.reply",
        "core.plugins.list",
        "core.knowledge.search",
    }
)


def infer_effect(action_id: str) -> str:
    lowered = action_id.lower()
    if any(h in lowered for h in READ_HINTS):
        return "read"
    return "write"


FALLBACK_PROMPT_ACTIONS = """1. "hr.leave_requests.batch_approve": (effect: write) Duyệt nghỉ phép, phê duyệt đơn.
2. "core.users.delete": (effect: critical) Xóa người dùng, xoá nhân viên.
3. "hr.employees.read": (effect: read) Tìm kiếm thông tin nhân viên, đọc thông tin."""


def build_catalog(
    plugin_repo=None,
    manifest_parser=None,
    tenant_id=None,
    include_static: bool = True,
) -> list[CatalogAction]:
    """Dựng catalog đồng bộ từ manifests (dùng cho prompt/UI).

    Phiên bản async ở dưới dùng khi cần lọc theo plugin ACTIVE của tenant.
    """
    actions: list[CatalogAction] = list(CORE_ACTIONS) if include_static else []
    if manifest_parser is None:
        return actions
    plugins_dir: Path | None = getattr(manifest_parser, "plugins_dir", None)
    if plugins_dir is None:
        plugins_dir = getattr(manifest_parser, "_plugins_dir", None)
    if plugins_dir is None:
        return actions
    try:
        for manifest_path in sorted(Path(plugins_dir).glob("*/manifest.yaml")):
            try:
                manifest = manifest_parser.parse(manifest_path.parent.name)
            except Exception as e:
                logger.warning("Bỏ qua manifest lỗi %s: %s", manifest_path, e)
                continue
            for wf in manifest.workflows or []:
                if getattr(wf, "trigger", None) != "webhook":
                    continue
                action_id = getattr(wf, "id", None) or Path(wf.file).stem
                prefix = manifest.name.split("-")[0]
                actions.append(
                    CatalogAction(
                        action=f"{prefix}.{action_id}",
                        effect_hint=infer_effect(action_id),
                        description=getattr(wf, "description", "")
                        or getattr(wf, "name", action_id),
                    )
                )
    except Exception as e:
        logger.warning("Không dựng được catalog động: %s", e)
    return actions


async def build_catalog_for_tenant(
    plugin_repo,
    manifest_parser,
    tenant_id,
    include_static: bool = True,
) -> list[CatalogAction]:
    """Catalog chỉ gồm plugin ACTIVE của tenant (+ core tĩnh)."""
    actions: list[CatalogAction] = list(CORE_ACTIONS) if include_static else []
    if plugin_repo is None or manifest_parser is None or tenant_id is None:
        return actions
    try:
        plugins, _ = await plugin_repo.list_installed(tenant_id=tenant_id)
    except Exception as e:
        logger.warning("Không liệt kê được plugin đã cài: %s", e)
        return actions
    for plugin in plugins:
        code = getattr(plugin, "code_name", None)
        if not code:
            continue
        try:
            manifest = manifest_parser.parse(code)
        except Exception as e:
            logger.warning("Bỏ qua manifest lỗi %s: %s", code, e)
            continue
        for wf in manifest.workflows or []:
            if getattr(wf, "trigger", None) != "webhook":
                continue
            action_id = getattr(wf, "id", None) or Path(wf.file).stem
            prefix = manifest.name.split("-")[0]
            actions.append(
                CatalogAction(
                    action=f"{prefix}.{action_id}",
                    effect_hint=infer_effect(action_id),
                    description=getattr(wf, "description", "")
                    or getattr(wf, "name", action_id),
                )
            )
    return actions


def render_for_prompt(actions: list[CatalogAction], limit: int = 60) -> str:
    lines = []
    for a in actions[:limit]:
        lines.append(f'- "{a.action}" (effect gợi ý: {a.effect_hint}) {a.description}')
    if len(actions) > limit:
        lines.append(f"... và {len(actions) - limit} actions khác.")
    return "\n".join(lines)


def resolve_workflow_webhook_url(
    manifest_parser, plugin_code: str, action_id: str
) -> str:
    """Dựng n8n webhook URL cho action 2-part {prefix}.{workflow_id}.

    Đọc workflow JSON của plugin, lấy webhook node path (giống
    PluginActionUseCase._resolve_webhook_url để 2 đường gọi nhất quán).
    Validate regex từng segment + chặn ../ + resolve().is_relative_to().
    """
    from app.infrastructure.config import settings

    if not isinstance(plugin_code, str) or not _PLUGIN_CODE_PATTERN.match(plugin_code):
        raise ValueError(f"Plugin '{plugin_code}' không hợp lệ.")
    if (
        not isinstance(action_id, str)
        or ".." in action_id
        or "/" in action_id
        or "\\" in action_id
        or not _ACTION_SEGMENT_PATTERN.match(action_id)
    ):
        raise ValueError(f"Action '{action_id}' không hợp lệ.")
    manifest = manifest_parser.parse(plugin_code)
    wf_file: str | None = None
    for wf in manifest.workflows or []:
        effective_id = getattr(wf, "id", None) or Path(wf.file).stem
        if effective_id == action_id and getattr(wf, "trigger", None) == "webhook":
            wf_file = wf.file
            break
    if wf_file is None:
        raise ValueError(
            f"Action '{action_id}' không thuộc plugin '{plugin_code}' "
            f"hoặc không phải webhook trigger."
        )
    if ".." in wf_file or wf_file.startswith("/"):
        raise ValueError(f"File workflow '{wf_file}' không hợp lệ.")
    plugins_dir = manifest_parser.plugins_dir
    wf_path = _ensure_inside_plugins_dir(
        Path(plugins_dir), Path(plugin_code) / wf_file
    )
    if not wf_path.is_file():
        raise ValueError(f"File workflow '{wf_file}' không tồn tại.")
    try:
        with open(wf_path, encoding="utf-8-sig") as f:
            wf_json = json.load(f)
    except (json.JSONDecodeError, OSError) as exc:
        raise ValueError(f"File workflow '{wf_file}' không đọc được: {exc}") from exc
    path = None
    for node in wf_json.get("nodes", []):
        if node.get("type") == "n8n-nodes-base.webhook":
            path = (node.get("parameters", {}) or {}).get("path")
            if path:
                break
    if not path:
        raise ValueError(
            f"Workflow '{wf_file}' không có webhook node — "
            f"chỉ workflow webhook mới gọi được."
        )
    base = settings.N8N_URL.rstrip("/")
    return f"{base}/webhook/{str(path).lstrip('/')}"


def split_plugin_action(action: str) -> tuple[str, str] | None:
    """Tách action 2-part {prefix}.{workflow_id} → (plugin_code, workflow_id).

    plugin_code suy ra {prefix}-module (VD: hr → hr-module).
    Validate mỗi segment ^[a-z0-9_-]+$, chặn '../' và '/' (M3).
    """
    if not isinstance(action, str) or not action:
        return None
    if ".." in action or "/" in action or "\\" in action:
        return None
    parts = action.split(".")
    if len(parts) != 2 or not all(parts):
        return None
    if not all(_ACTION_SEGMENT_PATTERN.match(p) for p in parts):
        return None
    return f"{parts[0]}-module", parts[1]
