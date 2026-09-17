// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import Image from "next/image";
import clsx from "clsx";
import { Download, CheckCircle2, ArrowUpCircle, XCircle, Trash2, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";

export type PluginStatus = "available" | "installing" | "active" | "update_available" | "failed" | "disabled";

export interface PluginData {
  id: string;
  name: string;
  codeName?: string;
  version: string;
  description: string;
  tablesCount?: number;
  workflowsCount?: number;
  requiredRoles?: string[];
  isOfficial?: boolean;
  developer?: string;
  author?: string | null;
  iconUrl?: string | null;
  rating?: number;
  category?: string;
  tags?: string[];
}

export interface PluginCardProps {
  plugin: PluginData;
  status: PluginStatus;
  installProgress?: number;
  canInstall?: boolean;
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
  canInstall = false,
  onInstall,
  onUpdate,
  onOpen,
  onRetry,
  onEnable,
  onUninstall,
}) => {
  const isDisabled = status === "disabled";
  const rating = plugin.rating ?? null;
  const category = plugin.category || "Utilities";
  const developer = plugin.author || plugin.developer || "Proteus Core";
  const tags = plugin.tags ?? [];

  const renderUninstallButton = () => {
    if (!onUninstall) return null;
    return (
      <Button
        variant="ghost"
        onClick={() => onUninstall(plugin.id)}
        disabled={!canInstall}
        className={canInstall ? "" : "opacity-50 cursor-not-allowed"}
        title={!canInstall ? "Bạn không có quyền thao tác" : "Gỡ cài đặt"}
      >
        {!canInstall ? <Lock className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
      </Button>
    );
  };

  const statusBadge = () => {
    switch (status) {
      case "active":
        return (
          <span className="status-badge status-badge--active">
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        );
      case "failed":
        return (
          <span className="status-badge status-badge--failed">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      case "disabled":
        return (
          <span className="status-badge status-badge--disabled">
            Disabled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={clsx("card p-5 flex flex-col gap-3", isDisabled && "opacity-60 grayscale-[50%]")}>
      {/* ── Header ── */}
      <div className="flex items-start gap-3.5">
        {/* Icon */}
        <div className="plugin-icon">
          {plugin.iconUrl ? (
            <Image src={plugin.iconUrl} alt={plugin.name} width={32} height={32} className="object-contain" />
          ) : (
            <span className="text-lg font-bold font-grot" style={{ color: "var(--accent)" }}>
              {plugin.name.charAt(0)}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[0.9375rem] font-semibold font-grot truncate" style={{ color: "var(--ink)" }}>
              {plugin.name}
            </h3>
            {plugin.isOfficial && (
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-mono text-meta truncate max-w-[120px]" style={{ color: "var(--dim)" }}>
              {developer}
            </span>
          </div>
          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="mono-tag !py-0.5 !px-1.5 !text-[9px] !gap-0 !border-0" style={{ background: "var(--paper)", color: "var(--dim)" }}>
              v{plugin.version}
            </span>
            <span className="mono-tag !py-0.5 !px-1.5 !text-[9px] !gap-0 !border-0" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              {category}
            </span>
            {rating && (
              <span className="font-mono text-meta ml-auto" style={{ color: "var(--amber)" }}>
                ★ {rating}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Description ── */}
      <p className="text-sm line-clamp-2 min-h-[2.5rem] leading-relaxed" style={{ color: "var(--muted)" }}>
        {plugin.description}
      </p>

      {/* ── Tags ── */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 4).map((tag) => (
            <span key={tag} className="tag-chip">{tag}</span>
          ))}
          {tags.length > 4 && (
            <span className="tag-chip" style={{ color: "var(--muted)" }}>+{tags.length - 4}</span>
          )}
        </div>
      )}

      {/* ── Separator ── */}
      <div className="separator" />

      {/* ── Actions ── */}
      <div className="mt-auto flex items-center justify-between min-h-[2.5rem]">
        {status === "available" && (
          <Button
            onClick={() => canInstall && onInstall?.(plugin.id)}
            disabled={!canInstall}
            className="w-full"
          >
            {!canInstall ? <Lock className="w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Nhận
          </Button>
        )}

        {status === "installing" && (
          <div className="w-full">
            <ProgressBar progress={installProgress} label="Đang cài đặt..." status="installing" />
          </div>
        )}

        {status === "active" && (
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpen?.(plugin.id)}>Mở</Button>
              {renderUninstallButton()}
            </div>
            {statusBadge()}
          </div>
        )}

        {status === "update_available" && (
          <Button onClick={() => onUpdate?.(plugin.id)} className="btn-accent w-full" style={{ background: "var(--amber)", borderColor: "var(--amber)" }}>
            <ArrowUpCircle className="w-4 h-4 mr-2" /> Cập nhật
          </Button>
        )}

        {status === "failed" && (
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => onRetry?.(plugin.id)}>Thử lại</Button>
              {renderUninstallButton()}
            </div>
            {statusBadge()}
          </div>
        )}

        {status === "disabled" && (
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onEnable?.(plugin.id)}>Bật</Button>
              {renderUninstallButton()}
            </div>
            {statusBadge()}
          </div>
        )}
      </div>
    </div>
  );
};
