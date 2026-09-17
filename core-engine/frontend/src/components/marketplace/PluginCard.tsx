// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import Image from "next/image";
import clsx from "clsx";
import { Download, CheckCircle2, ArrowUpCircle, XCircle, Trash2, ShieldCheck, Lock, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";

export type PluginStatus = "available" | "installing" | "active" | "update_available" | "failed" | "disabled" | "uninstalling" | "upgrading";

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
  // Dùng rating thực tế nếu có; không dùng Math.random() để tránh flicker
  const rating = plugin.rating ?? null;
  const category = plugin.category || "Utilities";
  const developer = plugin.author || plugin.developer || "Proteus Core";
  
  const renderUninstallButton = () => {
    if (!onUninstall) return null;
    return (
      <Button 
        variant="ghost" 
        onClick={() => onUninstall(plugin.id)} 
        disabled={!canInstall}
        className={clsx(
          "px-3",
          canInstall ? "text-text-muted hover:text-danger hover:bg-danger/10" : "text-text-muted/50 cursor-not-allowed"
        )} 
        title={!canInstall ? "Bạn không có quyền thao tác (plugins:install)" : "Gỡ cài đặt"}
      >
        {!canInstall ? <Lock className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
      </Button>
    );
  };

  return (
    <div 
      className={clsx(
        "group relative flex flex-col gap-4 p-5 rounded-[20px] border border-slate-200/90",
        "bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] overflow-hidden transition-all duration-200",
        "hover:-translate-y-1 hover:border-indigo-300 hover:shadow-[0_20px_44px_-18px_rgba(99,102,241,0.35)]",
        "dark:bg-bg-glass dark:backdrop-blur-glass dark:border-border/50 dark:shadow-none dark:hover:border-brand-primary/30 dark:hover:shadow-2xl",
        isDisabled && "opacity-60 grayscale-[50%]"
      )}
    >
      {/* Background wash on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none dark:from-brand-primary/5" />

      {/* Header Section */}
      <div className="relative flex items-start gap-4">
        {/* App Icon — dùng icon_url nếu có */}
        <div className="w-16 h-16 rounded-2xl shrink-0 bg-indigo-600/[0.07] border border-indigo-600/15 flex items-center justify-center shadow-sm relative overflow-hidden group-hover:scale-105 transition-transform duration-200 dark:bg-gradient-to-br dark:from-bg-surface-elevated dark:to-bg-surface dark:border-border/50 dark:shadow-inner">
          {plugin.iconUrl ? (
            <Image src={plugin.iconUrl} alt={plugin.name} width={40} height={40} className="object-contain" />
          ) : (
            <span className="text-2xl font-black text-indigo-600 dark:bg-clip-text dark:text-transparent dark:bg-gradient-to-br dark:from-text-primary dark:to-text-secondary drop-shadow-sm">
              {plugin.name.charAt(0)}
            </span>
          )}
          {/* Subtle shine effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 translate-x-[-100%] group-hover:translate-x-[100%] transition-all duration-1000" />
        </div>

        {/* Title and Meta */}
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate dark:text-text-primary" title={plugin.name}>
            {plugin.name}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 dark:text-text-secondary">
            <span className="truncate max-w-[100px]">{developer}</span>
            {plugin.isOfficial && (
              <span title="Official Plugin">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-brand-primary" />
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 dark:bg-bg-surface-elevated dark:text-text-secondary dark:border-border-subtle">
              v{plugin.version}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600/[0.08] text-indigo-700 border border-indigo-600/15 dark:bg-brand-primary/10 dark:text-brand-primary dark:border-brand-primary/20">
              {category}
            </span>
            {rating !== null && (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-warning">
                <Star className="h-3 w-3 fill-amber-500 dark:fill-warning" aria-hidden="true" />
                {rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="relative text-sm text-slate-500 line-clamp-2 min-h-[2.5rem] leading-relaxed dark:text-text-secondary">
        {plugin.description}
      </p>

      {/* Divider */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-border/50" />

      {/* Action Area */}
      <div className="relative mt-auto pt-2 flex items-center justify-between min-h-[2.5rem]">
        {status === "available" && (
          <Button 
            onClick={() => canInstall && onInstall?.(plugin.id)} 
            disabled={!canInstall}
            className={clsx(
              "w-full font-semibold shadow-sm transition-shadow",
              canInstall ? "hover:shadow-md" : "opacity-50 cursor-not-allowed"
            )}
            title={!canInstall ? "Bạn không có quyền cài đặt Plugin (plugins:install)" : ""}
          >
            {!canInstall ? <Lock className="w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />} Nhận
          </Button>
        )}
        
        {status === "installing" && (
          <div className="w-full space-y-1.5">
            <div className="flex justify-between text-xs text-brand-primary font-medium">
              <span>Đang cài đặt...</span>
              <span>{installProgress}%</span>
            </div>
            <ProgressBar progress={installProgress} label="" status="installing" />
          </div>
        )}

        {status === "active" && (
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                onClick={() => onOpen?.(plugin.id)} 
                className="bg-bg-surface-elevated hover:bg-bg-surface-hover text-text-primary border-border/50"
              >
                Mở
              </Button>
              {renderUninstallButton()}
            </div>
            <span className="flex items-center text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full border border-success/20">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Đã cài
            </span>
          </div>
        )}

        {status === "update_available" && (
          <Button 
            onClick={() => onUpdate?.(plugin.id)} 
            className="w-full bg-warning text-bg-base hover:bg-warning/90 hover:text-bg-base border-0 font-semibold"
          >
            <ArrowUpCircle className="w-4 h-4 mr-2" /> Cập nhật
          </Button>
        )}

        {status === "failed" && (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button variant="danger" onClick={() => onRetry?.(plugin.id)} className="font-semibold">Thử lại</Button>
              {renderUninstallButton()}
            </div>
            <span className="flex items-center text-xs font-medium text-danger bg-danger/10 px-2.5 py-1 rounded-full border border-danger/20">
              <XCircle className="w-3.5 h-3.5 mr-1" /> Lỗi
            </span>
          </div>
        )}

        {status === "disabled" && (
          <div className="flex items-center justify-between w-full">
            <Button variant="secondary" onClick={() => onEnable?.(plugin.id)} className="font-semibold">Bật</Button>
            {renderUninstallButton()}
          </div>
        )}
      </div>
    </div>
  );
};
