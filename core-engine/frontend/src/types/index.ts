// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// TypeScript Types — Domain Types (dựa trên OpenAPI docs/api-swagger.yaml)

export type PluginStatus =
  | "INSTALLING"
  | "ACTIVE"
  | "FAILED_DIRTY"
  | "DISABLED"
  | "UNINSTALLING"
  | "DELETED"
  | "PENDING_CREDENTIALS";

export type EffectLevel = "read" | "write" | "critical";

export type AICommandStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED"
  | "TIMEOUT";

// ─── Credential Schema Types ────────────────────────────────

export type CredentialFieldType = "string" | "password" | "number" | "boolean" | "select";

/** Mô tả một trường credential trong manifest (dùng để render form động). */
export interface CredentialFieldSchema {
  key: string;
  label: string;
  type: CredentialFieldType;
  required: boolean;
  placeholder?: string | null;
  description?: string | null;
  default?: string | number | boolean | null;
  options?: string[] | null;
  credential_type_name?: string | null;
}

/** Giá trị credential nhập bởi người dùng khi cài plugin. */
export interface CredentialInput {
  key: string;
  value: string;
  credential_type_name?: string | null;
}

// ─── API Response Types ─────────────────────────────────────

/** Plugin item trong danh sách (Marketplace hoặc Installed). */
export interface Plugin {
  id: string;
  code_name: string;
  display_name: string;
  description?: string | null;
  version: string;
  author?: string | null;
  icon_url?: string | null;
  homepage_url?: string | null;
  category: string;
  tags: string[];
  is_official: boolean;
  download_count: number;
  published_at?: string | null;
  status?: PluginStatus | null;
  tables_count?: number;
  workflows_count?: number;
  roles?: string[];
  credentials_schema: CredentialFieldSchema[];
}

/** Plugin detail (thêm screenshots, long_description, license). */
export interface PluginDetail extends Plugin {
  screenshots: string[];
  long_description?: string | null;
  license?: string | null;
}

export interface PluginListResponse {
  items: Plugin[];
  total: number;
}

/** PluginInfo alias (backward compat với useMarketplace). */
export type PluginInfo = Plugin;

export interface AICommandRequest {
  dsl_version: string;
  session_id: string;
  action: string;
  effect: EffectLevel;
  parameters: Record<string, unknown>;
  approval_message?: string;
}

export interface AICommandResponse {
  command_id: string;
  status: AICommandStatus;
  message: string;
  result?: Record<string, unknown>;
}

// ─── Install Task Status ─────────────────────────────────────

export type InstallTaskOverallStatus =
  | "INSTALLING"
  | "ACTIVE"
  | "FAILED_DIRTY"
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "ROLLING_BACK";

export type InstallTaskStepStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export interface InstallTaskStep {
  step: string;
  status: InstallTaskStepStatus;
  at?: string | null;
  message?: string | null;
}

export interface InstallTaskStatus {
  overall_status: InstallTaskOverallStatus;
  steps: InstallTaskStep[];
  plugin_id?: string | null;
}
