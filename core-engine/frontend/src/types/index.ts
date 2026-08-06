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
