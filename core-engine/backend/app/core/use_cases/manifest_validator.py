# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Manifest Validator Use Case
# Validate plugin manifest.yaml theo đặc tả v1.1.0.
# Plugin Manager gọi validator này ĐẦU TIÊN trước mọi bước install.
#
# Tham khảo: docs/plugin-manifest-spec.md

from __future__ import annotations

import logging
import re
from typing import Any

import yaml
from pydantic import BaseModel, Field, field_validator

from app.core.domain.exceptions import DSLInvalidParametersError

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# REGEX & CONSTANTS
# ─────────────────────────────────────────────────────────────

# Kebab-case: chỉ chứa chữ thường, số và dấu '-'
_KEBAB_CASE_REGEX = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

# Semantic Versioning: MAJOR.MINOR.PATCH (optional pre-release)
_SEMVER_REGEX = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)"
    r"(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
)

# Các path hệ thống bị cấm cho ui_apps
_SYSTEM_PATHS: frozenset[str] = frozenset(
    {
        "/auth",
        "/api",
        "/chat",
        "/files",
        "/wiki",
        "/workflow",
        "/analytics",
        "/monitoring",
    }
)

# UI App path format: chỉ chứa chữ thường, số, dấu '-' và '/'
_APP_PATH_REGEX = re.compile(r"^/apps/[a-z0-9]+([a-z0-9/-]*[a-z0-9])?$")

# Required fields trong metadata (§3.1)
_REQUIRED_METADATA_FIELDS: tuple[str, ...] = (
    "name",
    "display_name",
    "version",
    "description",
    "author",
    "license",
)


# ─────────────────────────────────────────────────────────────
# MANIFEST ENTITY (output của validator)
# ─────────────────────────────────────────────────────────────


class WorkflowEntry(BaseModel):
    """Mô tả một workflow trong manifest."""

    file: str
    name: str
    description: str = ""
    trigger: str  # webhook | cron | manual
    cron_expression: str | None = None


class DashboardEntry(BaseModel):
    """Mô tả một dashboard trong manifest."""

    file: str
    name: str
    description: str = ""


class UIAppEntry(BaseModel):
    """Mô tả một UI App trong manifest."""

    file: str
    name: str
    path: str


class RoleEntry(BaseModel):
    """Mô tả một Role trong manifest."""

    name: str
    display_name: str
    description: str = ""
    permissions: list[str] = Field(default_factory=list)


class EventSubscriptionEntry(BaseModel):
    """Mô tả một event subscription trong manifest."""

    source_plugin: str
    event_types: list[str]
    handler_workflow: str


class EventPublicationEntry(BaseModel):
    """Mô tả một event publication trong manifest."""

    event_type: str
    description: str = ""
    payload_schema: dict[str, str] = Field(default_factory=dict)


class DependencySpec(BaseModel):
    """Mô tả dependency."""

    plugin: str
    reason: str = ""
    min_version: str | None = None


class ManifestEntity(BaseModel):
    """
    Domain Entity cho Plugin Manifest (đã validate).

    Đây là output của ManifestValidator.
    Chứa toàn bộ thông tin đã parse và validate từ manifest.yaml.
    """

    # Metadata (§3.1)
    name: str
    display_name: str
    version: str
    description: str
    author: str
    license: str
    icon_url: str | None = None
    is_official: bool = False
    homepage_url: str | None = None

    # Database (§3.2)
    tables: list[str] = Field(default_factory=list)
    seed_file: str | None = None
    default_config: dict[str, Any] = Field(default_factory=dict)

    # Workflows (§3.3)
    workflows: list[WorkflowEntry] = Field(default_factory=list)

    # Dashboards (§3.4)
    dashboards: list[DashboardEntry] = Field(default_factory=list)

    # UI Apps (§3.5)
    ui_apps: list[UIAppEntry] = Field(default_factory=list)

    # Roles (§3.6)
    roles: list[RoleEntry] = Field(default_factory=list)

    # Event Subscriptions (§3.7)
    event_subscriptions: list[EventSubscriptionEntry] = Field(default_factory=list)

    # Event Publications
    event_publications: list[EventPublicationEntry] = Field(default_factory=list)

    # Dependencies
    dependencies_required: list[DependencySpec] = Field(default_factory=list)
    dependencies_optional: list[DependencySpec] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def validate_name_format(cls, v: str) -> str:
        if not _KEBAB_CASE_REGEX.match(v):
            raise ValueError(
                f"Plugin name '{v}' phải ở dạng kebab-case "
                f"(chỉ chứa chữ thường, số và dấu '-')"
            )
        return v

    @field_validator("version")
    @classmethod
    def validate_version_format(cls, v: str) -> str:
        if not _SEMVER_REGEX.match(v):
            raise ValueError(
                f"Version '{v}' không đúng Semantic Versioning (MAJOR.MINOR.PATCH)"
            )
        return v


# ─────────────────────────────────────────────────────────────
# MANIFEST VALIDATOR USE CASE
# ─────────────────────────────────────────────────────────────


class ManifestValidator:
    """
    Use Case: Validate manifest.yaml của Plugin.

    Plugin Manager gọi validator này ĐẦU TIÊN trước mọi bước cài đặt.
    Nếu manifest không hợp lệ → raise DSLInvalidParametersError, dừng install.

    Validation rules (theo plugin-manifest-spec.md v1.1.0):
    1. Required fields: name, display_name, version, description, author, license
    2. name format: kebab-case (regex: ^[a-z0-9]+(-[a-z0-9]+)*$)
    3. version: Semantic Versioning (MAJOR.MINOR.PATCH)
    4. Table names: prefix phải khớp tên plugin (hr-module → prefix hr_)
    5. ui_apps[].path: bắt đầu /apps/, không trùng path hệ thống
    6. workflows[].trigger=cron → bắt buộc có cron_expression
    """

    def validate_yaml_string(self, yaml_content: str) -> ManifestEntity:
        """
        Parse và validate manifest từ YAML string.

        Args:
            yaml_content: Nội dung YAML dạng string.

        Returns:
            ManifestEntity đã validate.

        Raises:
            DSLInvalidParametersError: Nếu manifest không hợp lệ.
        """
        try:
            data = yaml.safe_load(yaml_content)
        except yaml.YAMLError as exc:
            raise DSLInvalidParametersError(
                f"manifest.yaml parse error: {exc}"
            ) from exc

        if not isinstance(data, dict):
            raise DSLInvalidParametersError(
                "manifest.yaml phải là một YAML mapping (dictionary)"
            )

        return self.validate(data)

    def validate(self, raw: dict[str, Any]) -> ManifestEntity:
        """
        Validate manifest data đã parse từ YAML.

        Args:
            raw: Dictionary đã parse từ YAML.

        Returns:
            ManifestEntity đã validate.

        Raises:
            DSLInvalidParametersError: Nếu manifest không hợp lệ.
        """
        errors: list[str] = []

        # ─── 1. Validate required metadata fields ───
        for field in _REQUIRED_METADATA_FIELDS:
            if field not in raw or not raw[field]:
                errors.append(f"Thiếu trường bắt buộc: '{field}'")

        if errors:
            raise DSLInvalidParametersError(
                "Manifest validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
            )

        name: str = raw["name"]

        # ─── 2. Validate name format (kebab-case) ───
        if not _KEBAB_CASE_REGEX.match(name):
            errors.append(
                f"Plugin name '{name}' phải ở dạng kebab-case "
                f"(regex: ^[a-z0-9]+(-[a-z0-9]+)*$)"
            )

        # ─── 3. Validate version (SemVer) ───
        version = raw.get("version", "")
        if version and not _SEMVER_REGEX.match(version):
            errors.append(
                f"Version '{version}' không đúng Semantic Versioning (MAJOR.MINOR.PATCH)"
            )

        # ─── 4. Validate table name prefix ───
        # Plugin name hr-module → prefix hr_
        expected_prefix = name.split("-")[0] + "_"
        database_section = raw.get("database", {}) or {}
        tables = database_section.get("tables", []) or []
        for table_name in tables:
            if not table_name.startswith(expected_prefix):
                errors.append(
                    f"Tên bảng '{table_name}' phải có prefix '{expected_prefix}' "
                    f"(theo plugin-manifest-spec.md §3.2)"
                )

        # ─── 5. Validate ui_apps paths ───
        ui_apps_raw = raw.get("ui_apps", []) or []
        for idx, app in enumerate(ui_apps_raw):
            app_path = app.get("path", "")
            if not app_path:
                errors.append(f"ui_apps[{idx}]: thiếu trường 'path'")
                continue

            # Path phải bắt đầu bằng /apps/
            if not app_path.startswith("/apps/"):
                errors.append(
                    f"ui_apps[{idx}].path '{app_path}' phải bắt đầu bằng '/apps/'"
                )

            # Path không được trùng path hệ thống
            normalized_path = app_path.rstrip("/").lower()
            for system_path in _SYSTEM_PATHS:
                if normalized_path == system_path or normalized_path.startswith(
                    system_path + "/"
                ):
                    errors.append(
                        f"ui_apps[{idx}].path '{app_path}' trùng với "
                        f"path hệ thống '{system_path}'"
                    )

            # Path format
            if app_path.startswith("/apps/") and not _APP_PATH_REGEX.match(app_path):
                errors.append(
                    f"ui_apps[{idx}].path '{app_path}' chỉ được chứa "
                    f"chữ thường, số, dấu '-' và '/'"
                )

        # ─── 6. Validate workflow cron trigger ───
        workflows_raw = raw.get("workflows", []) or []
        for idx, wf in enumerate(workflows_raw):
            trigger = wf.get("trigger", "")
            if trigger == "cron" and not wf.get("cron_expression"):
                errors.append(
                    f"workflows[{idx}]: trigger='cron' nhưng thiếu 'cron_expression'"
                )
            if trigger not in ("webhook", "cron", "manual", ""):
                errors.append(
                    f"workflows[{idx}]: trigger '{trigger}' không hợp lệ "
                    f"(phải là webhook, cron hoặc manual)"
                )

        # ─── Raise tất cả lỗi nếu có ───
        if errors:
            raise DSLInvalidParametersError(
                f"Manifest validation failed ({len(errors)} lỗi):\n"
                + "\n".join(f"  - {e}" for e in errors)
            )

        # ─── Build ManifestEntity ───
        try:
            entity = ManifestEntity(
                # Metadata
                name=name,
                display_name=raw["display_name"],
                version=raw["version"],
                description=raw["description"],
                author=raw["author"],
                license=raw["license"],
                icon_url=raw.get("icon_url"),
                is_official=raw.get("is_official", False),
                homepage_url=raw.get("homepage_url"),
                # Database
                tables=tables,
                seed_file=database_section.get("seed_file"),
                default_config=database_section.get("default_config", {}) or {},
                # Workflows
                workflows=[WorkflowEntry(**wf) for wf in workflows_raw],
                # Dashboards
                dashboards=[
                    DashboardEntry(**db) for db in (raw.get("dashboards", []) or [])
                ],
                # UI Apps
                ui_apps=[UIAppEntry(**app) for app in ui_apps_raw],
                # Roles
                roles=[RoleEntry(**role) for role in (raw.get("roles", []) or [])],
                # Event Subscriptions
                event_subscriptions=[
                    EventSubscriptionEntry(**sub)
                    for sub in (raw.get("event_subscriptions", []) or [])
                ],
                # Event Publications
                event_publications=[
                    EventPublicationEntry(**pub)
                    for pub in (raw.get("event_publications", []) or [])
                ],
                # Dependencies
                dependencies_required=[
                    DependencySpec(**dep)
                    for dep in (
                        (raw.get("dependencies", {}) or {}).get("required", []) or []
                    )
                ],
                dependencies_optional=[
                    DependencySpec(**dep)
                    for dep in (
                        (raw.get("dependencies", {}) or {}).get("optional", []) or []
                    )
                ],
            )
        except Exception as exc:
            raise DSLInvalidParametersError(
                f"Manifest entity construction failed: {exc}"
            ) from exc

        logger.info(
            "Manifest validated successfully",
            extra={
                "plugin_name": entity.name,
                "version": entity.version,
                "tables_count": len(entity.tables),
                "workflows_count": len(entity.workflows),
                "dashboards_count": len(entity.dashboards),
                "ui_apps_count": len(entity.ui_apps),
                "roles_count": len(entity.roles),
            },
        )
        return entity
