# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Plugin Manifest Entities
# Single source of truth for plugin manifest structure.
# ManifestValidator (use_cases) validates data; this module defines the domain model.

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────
# CREDENTIAL SCHEMA (§3.0 — mới)
# ─────────────────────────────────────────────────────────────


class ManifestCredentialField(BaseModel):
    """
    Mô tả một trường credential mà plugin yêu cầu khi cài đặt.
    Frontend sẽ render form động dựa trên danh sách này.
    Không lưu vào DB của Proteus — chỉ forward sang n8n / Secrets Vault.
    """

    key: str
    """Khóa định danh (sẽ là key trong dict gửi sang n8n)."""

    label: str
    """Nhãn hiển thị trên UI (tiếng Việt hoặc tiếng Anh)."""

    type: Literal["string", "password", "number", "boolean", "select"] = "string"
    """Kiểu input: string | password | number | boolean | select."""

    required: bool = True
    """True nếu plugin không thể hoạt động nếu thiếu field này."""

    placeholder: str | None = None
    """Gợi ý giá trị mẫu hiển thị trong input."""

    description: str | None = None
    """Mô tả chi tiết về ý nghĩa của field."""

    default: str | int | bool | None = None
    """Giá trị mặc định (nếu có)."""

    options: list[str] | None = None
    """Danh sách lựa chọn — chỉ dùng khi type='select'."""

    credential_type_name: str | None = None
    """n8n credential type name (VD: 'smtp', 'githubApi', 'postgres').
    Nếu None → dùng giá trị của 'key' làm fallback."""


# ─────────────────────────────────────────────────────────────
# SUB-MODELS
# ─────────────────────────────────────────────────────────────


class ManifestCompatibility(BaseModel):
    proteus_os_min_version: str
    dsl_spec_version: str | None = None


class ManifestDatabase(BaseModel):
    tables: list[str] = Field(default_factory=list)
    seed_file: str | None = None
    default_config: dict[str, Any] = Field(default_factory=dict)


class ManifestWorkflow(BaseModel):
    file: str
    name: str
    description: str | None = None
    trigger: str  # webhook, cron, manual
    cron_expression: str | None = None


class ManifestDashboard(BaseModel):
    file: str
    name: str
    description: str | None = None


class ManifestUIApp(BaseModel):
    file: str
    name: str
    path: str


class ManifestRole(BaseModel):
    name: str
    display_name: str | None = None
    description: str | None = None
    permissions: list[str] = Field(default_factory=list)


class ManifestEventSubscription(BaseModel):
    source_plugin: str
    event_types: list[str] = Field(default_factory=list)
    handler_workflow: str


class ManifestEventPublication(BaseModel):
    event_type: str
    description: str | None = None
    payload_schema: dict[str, Any] = Field(default_factory=dict)


class ManifestDependency(BaseModel):
    plugin: str
    reason: str | None = None
    min_version: str | None = None


class ManifestDependencies(BaseModel):
    required: list[ManifestDependency] = Field(default_factory=list)
    optional: list[ManifestDependency] = Field(default_factory=list)


class ManifestChangelogEntry(BaseModel):
    """Một entry trong changelog của plugin."""

    version: str
    date: str | None = None
    changes: list[str] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────
# ROOT ENTITY
# ─────────────────────────────────────────────────────────────

# Danh mục plugin hợp lệ
VALID_PLUGIN_CATEGORIES = frozenset({
    "HR",
    "CRM",
    "Finance",
    "Analytics",
    "Communication",
    "Utilities",
    "IT",
    "Operations",
    "Legal",
    "Other",
})


class PluginManifest(BaseModel):
    """
    Domain Entity representing the parsed manifest.yaml of a Plugin.
    Đây là single source of truth cho cấu trúc manifest.
    ManifestValidator (use_cases) validate dữ liệu trước khi tạo entity này.
    """

    # ─── Metadata bắt buộc (§3.1) ─────────────────────────────
    name: str
    display_name: str
    version: str
    description: str
    author: str
    license: str

    # ─── Metadata tùy chọn ────────────────────────────────────
    icon_url: str | None = None
    is_official: bool = False
    homepage_url: str | None = None
    category: str = "Utilities"
    """Danh mục plugin: HR | CRM | Finance | Analytics | Communication | Utilities | IT | Operations | Legal | Other"""
    tags: list[str] = Field(default_factory=list)
    """Tags tìm kiếm (VD: ['nhân sự', 'chấm công'])."""
    screenshots: list[str] = Field(default_factory=list)
    """Đường dẫn đến ảnh chụp màn hình trong thư mục plugin."""
    long_description: str | None = None
    """Mô tả chi tiết dạng Markdown, hiển thị trên Plugin Detail page."""

    # ─── Credentials (§3.0 — mới) ─────────────────────────────
    credentials_schema: list[ManifestCredentialField] = Field(default_factory=list)
    """
    Khai báo các credentials cần thiết khi cài đặt plugin.
    Frontend render form động dựa trên danh sách này.
    Plugin không cần credentials bên ngoài → để danh sách rỗng [].
    """

    # ─── Compatibility ─────────────────────────────────────────
    compatibility: ManifestCompatibility

    # ─── Database ─────────────────────────────────────────────
    database: ManifestDatabase | None = None

    # ─── Extensions ───────────────────────────────────────────
    workflows: list[ManifestWorkflow] = Field(default_factory=list)
    dashboards: list[ManifestDashboard] = Field(default_factory=list)
    ui_apps: list[ManifestUIApp] = Field(default_factory=list)
    roles: list[ManifestRole] = Field(default_factory=list)
    event_subscriptions: list[ManifestEventSubscription] = Field(default_factory=list)
    event_publications: list[ManifestEventPublication] = Field(default_factory=list)
    dependencies: ManifestDependencies = Field(default_factory=ManifestDependencies)

    # ─── Changelog ────────────────────────────────────────────
    changelog: list[ManifestChangelogEntry] = Field(default_factory=list)

    def get_credentials_schema_as_dict(self) -> list[dict[str, Any]]:
        """Trả về credentials_schema dưới dạng list[dict] để lưu vào DB (JSONB)."""
        return [f.model_dump(exclude_none=True) for f in self.credentials_schema]

    def requires_credentials(self) -> bool:
        """Kiểm tra xem plugin có yêu cầu credentials bắt buộc không."""
        return any(f.required for f in self.credentials_schema)
