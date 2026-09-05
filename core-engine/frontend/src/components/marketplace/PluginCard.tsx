// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import clsx from "clsx";
import { Download, CheckCircle2, ArrowUpCircle, XCircle, Trash2, ShieldCheck } from "lucide-react";
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
  rating?: number;
  category?: string;
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
  // Dùng rating thực tế nếu có; không dùng Math.random() để tránh flicker
  const rating = plugin.rating ?? null;
  const category = plugin.category || "Utilities";
  // author field thực tế từ backend thay vì hardcode
  const developer = plugin.author || plugin.developer || "Proteus Core";

  return (
    <div 
      className={clsx(
        "group relative flex flex-col gap-4 p-5 rounded-2xl border border-border/50",
        "bg-bg-glass backdrop-blur-glass overflow-hidden transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-2xl hover:border-brand-primary/30",
        isDisabled && "opacity-60 grayscale-[50%]"
      )}
    >
      {/* Background Gradient Glow on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Header Section */}
      <div className="relative flex items-start gap-4">
        {/* App Icon — dùng icon_url nếu có */}
        <div className="w-16 h-16 rounded-2xl shrink-0 bg-gradient-to-br from-bg-surface-elevated to-bg-surface border border-border/50 flex items-center justify-center shadow-inner relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
          {plugin.iconUrl ? (
            <img src={plugin.iconUrl} alt={plugin.name} className="w-10 h-10 object-contain" />
          ) : (
            <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-br from-text-primary to-text-secondary drop-shadow-sm">
              {plugin.name.charAt(0)}
            </span>
          )}
          {/* Subtle shine effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 translate-x-[-100%] group-hover:translate-x-[100%] transition-all duration-1000" />
        </div>

        {/* Title and Meta */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-text-primary truncate" title={plugin.name}>
            {plugin.name}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-0.5">
            <span className="truncate max-w-[100px]">{developer}</span>
            {plugin.isOfficial && (
              <span title="Official Plugin">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-bg-surface-elevated text-text-secondary border border-border-subtle">
              v{plugin.version}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              {category}
            </span>
            <span className="inline-flex items-center text-[10px] text-warning font-medium ml-auto">
              ★ {rating}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="relative text-sm text-text-secondary line-clamp-2 min-h-[2.5rem] leading-relaxed">
        {plugin.description}
      </p>

      {/* Divider */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

      {/* Action Area */}
      <div className="relative mt-auto pt-2 flex items-center justify-between min-h-[2.5rem]">
        {status === "available" && onInstall && (
          <Button 
            onClick={() => onInstall(plugin.id)} 
            className="w-full font-semibold shadow-sm hover:shadow-md transition-shadow"
          >
            <Download className="w-4 h-4 mr-2" /> Nhận
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
              {onUninstall && (
                <Button 
                  variant="ghost" 
                  onClick={() => onUninstall(plugin.id)} 
                  className="text-text-muted hover:text-danger hover:bg-danger/10 px-3" 
                  title="Gỡ cài đặt"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
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
              {onUninstall && (
                <Button 
                  variant="ghost" 
                  onClick={() => onUninstall(plugin.id)} 
                  className="text-danger border-danger/30 hover:border-danger hover:bg-danger/10 px-3" 
                  title="Xoá dữ liệu lỗi"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <span className="flex items-center text-xs font-medium text-danger bg-danger/10 px-2.5 py-1 rounded-full border border-danger/20">
              <XCircle className="w-3.5 h-3.5 mr-1" /> Lỗi
            </span>
          </div>
        )}

        {status === "disabled" && (
          <div className="flex items-center justify-between w-full">
            <Button variant="secondary" onClick={() => onEnable?.(plugin.id)} className="font-semibold">Bật</Button>
            {onUninstall && (
              <Button 
                variant="ghost" 
                onClick={() => onUninstall(plugin.id)} 
                className="text-text-muted hover:text-danger hover:bg-danger/10 px-3" 
                title="Gỡ cài đặt"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
