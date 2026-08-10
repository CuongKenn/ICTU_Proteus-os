// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import clsx from "clsx";
import { Button } from "./Button";
import { ProgressBar } from "./ProgressBar";
import { CheckCircle2, ArrowUpCircle, XCircle, Trash2 } from "lucide-react";

export type PluginStatus = "available" | "installing" | "active" | "update_available" | "failed" | "disabled";

export interface PluginData {
  id: string;
  name: string;
  version: string;
  description: string;
  tablesCount: number;
  workflowsCount: number;
  requiredRoles: string[];
  isOfficial?: boolean;
}

export interface PluginCardProps {
  plugin: PluginData;
  status: PluginStatus;
  installProgress?: number;
  onInstall?: (id: string) => void;
  onUpdate?: (id: string) => void;
  onOpen?: (id: string) => void;
  onRetry?: (id: string) => void;
  onEnable?: (id: string) => void;
  onUninstall?: (id: string) => void;
}

export const PluginCard: React.FC<PluginCardProps> = ({
  plugin,
  status,
  installProgress = 0,
  onInstall,
  onUpdate,
  onOpen,
  onRetry,
  onEnable,
  onUninstall,
}) => {
  const isDisabled = status === "disabled";
  
  return (
    <div className={clsx("glass-card p-4 flex flex-col gap-4 relative", isDisabled && "opacity-60 grayscale-[50%]")}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl glass flex items-center justify-center shrink-0 border border-border">
          <span className="text-xl font-bold text-primary">{plugin.name.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-text-primary truncate pr-4">{plugin.name}</h3>
          <div className="flex items-center gap-2 text-xs text-text-secondary mt-1">
            <span>v{plugin.version}</span>
            {plugin.isOfficial && (
              <span className="flex items-center text-warning">
                <span className="mr-1">⭐</span> Official
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-text-secondary line-clamp-2 min-h-[2.5rem]">
        {plugin.description}
      </p>

      {/* Stats */}
      <div className="flex flex-col gap-2 text-xs text-text-muted mt-2 border-t border-border-subtle pt-3">
        <div className="flex gap-4">
          <span>📦 {plugin.tablesCount} tables</span>
          <span>🔄 {plugin.workflowsCount} workflows</span>
        </div>
        <div className="truncate" title={plugin.requiredRoles.join(", ")}>
          👤 {plugin.requiredRoles.join(", ")}
        </div>
      </div>

      {/* Action Area */}
      <div className="mt-auto pt-4 flex items-center justify-between min-h-[3rem]">
        {status === "available" && onInstall && (
          <Button onClick={() => onInstall(plugin.id)}>INSTALL</Button>
        )}
        
        {status === "installing" && (
          <div className="w-full">
            <ProgressBar progress={installProgress} label="Installing..." status="installing" />
          </div>
        )}

        {status === "active" && (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => onOpen?.(plugin.id)} className="text-success border-success/30 hover:border-success">
                OPEN
              </Button>
              {onUninstall && (
                <Button variant="ghost" onClick={() => onUninstall(plugin.id)} className="text-danger border-danger/30 hover:border-danger p-2" title="Gỡ cài đặt">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <span className="flex items-center text-xs text-success bg-success/10 px-2 py-1 rounded-full border border-success/20">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Đã cài
            </span>
          </div>
        )}

        {status === "update_available" && (
          <Button onClick={() => onUpdate?.(plugin.id)} className="bg-warning text-bg-base hover:bg-warning/90 hover:text-bg-base border-0">
            <ArrowUpCircle className="w-4 h-4 mr-2" /> UPDATE
          </Button>
        )}

        {status === "failed" && (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button variant="danger" onClick={() => onRetry?.(plugin.id)}>RETRY</Button>
              {onUninstall && (
                <Button variant="ghost" onClick={() => onUninstall(plugin.id)} className="text-danger border-danger/30 hover:border-danger p-2" title="Gỡ cài đặt">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <span className="flex items-center text-xs text-danger bg-danger/10 px-2 py-1 rounded-full border border-danger/20">
              <XCircle className="w-3 h-3 mr-1" /> FAILED
            </span>
          </div>
        )}

        {status === "disabled" && (
          <div className="flex items-center justify-between w-full">
            <Button variant="secondary" onClick={() => onEnable?.(plugin.id)}>ENABLE</Button>
            {onUninstall && (
              <Button variant="ghost" onClick={() => onUninstall(plugin.id)} className="text-danger border-danger/30 hover:border-danger p-2" title="Gỡ cài đặt">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
