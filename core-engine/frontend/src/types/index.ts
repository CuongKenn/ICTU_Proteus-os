// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// TypeScript Types — Domain Types (dựa trên OpenAPI docs/api-swagger.yaml)
// Member cần bổ sung khi implement thêm feature.

export type PluginStatus =
  | "INSTALLING"
  | "ACTIVE"
  | "FAILED_DIRTY"
  | "DISABLED"
  | "UNINSTALLING"
  | "DELETED";

export type EffectLevel = "read" | "write" | "critical";

export type AICommandStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED"
  | "TIMEOUT";

// ─── API Response Types ────────────────────────────────────────

export interface Plugin {
  id: string;
  code_name: string;
  display_name: string;
  version: string;
  is_official: boolean;
  status?: PluginStatus;
  tables_count?: number;
  workflows_count?: number;
  roles?: string[];
}

export interface PluginListResponse {
  items: Plugin[];
  total: number;
}

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

export interface PluginInfo {
  id: string;
  code_name: string;
  display_name: string;
  description: string;
  version: string;
  author: string;
  icon_url?: string;
  is_official: boolean;
  download_count: number;
  tables_count?: number;
  workflows_count?: number;
  roles?: string[];
}

export type InstallTaskOverallStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "ROLLING_BACK";

export type InstallTaskStepStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export interface InstallTaskStep {
  step_name: string;
  status: InstallTaskStepStatus;
  message?: string | null;
}

export interface InstallTaskStatus {
  task_id: string;
  plugin_code_name: string;
  overall_status: InstallTaskOverallStatus;
  steps: InstallTaskStep[];
  started_at: string;
  completed_at?: string | null;
}
