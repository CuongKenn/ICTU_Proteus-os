# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Plugin Manifest Entities

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


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
    display_name: str
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


class PluginManifest(BaseModel):
    """
    Domain Entity representing the parsed manifest.yaml of a Plugin.
    """

    name: str
    display_name: str
    version: str
    description: str
    author: str
    license: str
    icon_url: str | None = None
    is_official: bool = False
    homepage_url: str | None = None

    compatibility: ManifestCompatibility
    database: ManifestDatabase | None = None
    workflows: list[ManifestWorkflow] = Field(default_factory=list)
    dashboards: list[ManifestDashboard] = Field(default_factory=list)
    ui_apps: list[ManifestUIApp] = Field(default_factory=list)
    roles: list[ManifestRole] = Field(default_factory=list)
    event_subscriptions: list[ManifestEventSubscription] = Field(default_factory=list)
    event_publications: list[ManifestEventPublication] = Field(default_factory=list)
    dependencies: ManifestDependencies = Field(default_factory=ManifestDependencies)
