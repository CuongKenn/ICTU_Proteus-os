// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// PageHero — khối hero dùng chung cho mọi trang (ui-ux-pro-max:
// Soft UI Evolution + Bento). Badge + tiêu đề display + mô tả +
// hàng stats + hàng CTA. Bản compact cho trang nhúng (chat/apps/wiki).

"use client";

import React from "react";

export interface HeroStat {
  /** Giá trị hiển thị, VD: 12 */
  value: React.ReactNode;
  /** Nhãn nhỏ bên dưới */
  label: string;
  /** Icon Lucide 16px */
  icon?: React.ReactNode;
}

interface PageHeroProps {
  badge?: { icon?: React.ReactNode; label: string };
  title: React.ReactNode;
  description?: React.ReactNode;
  stats?: HeroStat[];
  actions?: React.ReactNode;
  /** Bản gọn cho trang iframe (padding nhỏ, không bóng lớn). */
  compact?: boolean;
}

export const PageHero: React.FC<PageHeroProps> = ({
  badge,
  title,
  description,
  stats,
  actions,
  compact = false,
}) => {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-bg-surface via-bg-surface/80 to-bg-base ${
        compact ? "p-5 sm:p-6" : "p-6 sm:p-8"
      }`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-primary/15 blur-[80px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-brand-secondary/10 blur-[80px]" />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-xl">
          {badge && (
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-brand-primary/25 bg-brand-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-primary">
              {badge.icon}
              {badge.label}
            </p>
          )}
          <h1
            className={`font-display font-extrabold tracking-tight text-text-primary text-balance ${
              compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
            }`}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{description}</p>
          )}
          {actions && <div className="mt-5 flex flex-wrap items-center gap-2.5">{actions}</div>}
        </div>
        {stats && stats.length > 0 && (
          <div className="grid shrink-0 grid-cols-3 gap-2.5 sm:gap-3" aria-label="Thống kê">
            {stats.map((s, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/60 bg-bg-glass px-4 py-3 text-center backdrop-blur-glass"
              >
                {s.icon && <div className="flex items-center justify-center text-brand-primary">{s.icon}</div>}
                <div className="mt-1 font-display text-xl font-extrabold text-text-primary">{s.value}</div>
                <div className="text-[11px] font-semibold text-text-secondary">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
