// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";

export type AppTone = "blue" | "violet" | "orange" | "emerald" | "rose" | "cyan" | "brand";

export interface AppIconProps {
  appName: string;
  icon: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  /** Mô tả ngắn hiển thị dưới tên app (1–2 dòng). */
  description?: string;
  /** Tông màu gradient của ô icon. */
  tone?: AppTone;
  /** Slot góc phải (vd. nút yêu thích) — cần tự stopPropagation. */
  topRight?: React.ReactNode;
}

const TONE_TILE: Record<AppTone, string> = {
  blue: "bg-blue-500/15 text-blue-400 ring-blue-400/30",
  violet: "bg-violet-500/15 text-violet-300 ring-violet-400/30",
  orange: "bg-orange-500/15 text-orange-400 ring-orange-400/30",
  emerald: "bg-emerald-500/15 text-emerald-400 ring-emerald-400/30",
  rose: "bg-rose-500/15 text-rose-400 ring-rose-400/30",
  cyan: "bg-cyan-500/15 text-cyan-300 ring-cyan-400/30",
  brand: "bg-brand-primary/15 text-brand-primary ring-brand-primary/30",
};

/**
 * AppIcon Pro — thẻ glassmorphism mở app (UI-UX-Pro-Max: Glassmorphism,
 * hover 150–300ms, focus-visible rõ ràng, target ≥ 44px).
 * Giữ nguyên API cũ (appName/icon/isActive/onClick) để tương thích.
 */
export const AppIcon: React.FC<AppIconProps> = ({
  appName,
  icon,
  isActive = false,
  onClick,
  description,
  tone = "brand",
  topRight,
}) => {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={appName}
      className="group relative flex cursor-pointer flex-col rounded-2xl glass-card p-4 outline-none transition-all duration-200 ease-out hover:-translate-y-1 hover:border-brand-primary/60 hover:shadow-[0_12px_32px_hsla(245,85%,65%,0.25)] focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base active:translate-y-0 active:scale-[0.99]"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {topRight && (
        <div className="absolute right-3 top-3 z-10" onClick={(e) => e.stopPropagation()}>
          {topRight}
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform duration-200 group-hover:scale-105 ${TONE_TILE[tone]}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-bold text-text-primary">
            {appName}
          </div>
          {isActive && (
            <div className="mt-1 inline-flex items-center text-[10px] font-semibold uppercase text-success">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Đang hoạt động
            </div>
          )}
        </div>
      </div>

      {description && (
        <p className="line-clamp-2 min-h-[2.2rem] text-xs leading-relaxed text-text-secondary">
          {description}
        </p>
      )}

      <div className="mt-3 flex items-center text-xs font-semibold text-brand-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        Mở ứng dụng
        <span aria-hidden="true" className="ml-1 transition-transform duration-200 group-hover:translate-x-0.5">→</span>
      </div>
    </div>
  );
};
