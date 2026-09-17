// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// EmptyState — khối trạng thái rỗng dùng chung (ui-ux-pro-max:
// Empty States guideline — thông điệp hữu ích + hành động rõ ràng,
// icon Lucide trong tile gradient, không dùng emoji).

"use client";

import React from "react";

interface EmptyStateProps {
  /** Icon Lucide, VD: <Blocks className="h-11 w-11 ..." /> */
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  hint?: React.ReactNode;
  actions?: React.ReactNode;
  /** Vẽ viền đứt nét như dropzone khi cần. */
  dashed?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  hint,
  actions,
  dashed = false,
}) => {
  return (
    <div
      className={`rounded-3xl border bg-bg-surface/30 p-10 text-center animate-fade-in sm:p-14 ${
        dashed ? "border-dashed border-border/70" : "border-border/60"
      }`}
      role="status"
    >
      <div className="group relative mx-auto mb-6 inline-flex h-24 w-24 items-center justify-center rounded-[28px] border border-brand-primary/25 bg-gradient-to-br from-brand-primary/15 via-bg-surface to-brand-secondary/10 transition-colors hover:border-brand-primary/50">
        <div className="absolute inset-0 rounded-[28px] bg-brand-primary/5 blur-xl transition-colors group-hover:bg-brand-primary/10" />
        <div className="relative z-10 text-brand-primary">{icon}</div>
      </div>
      <h3 className="mb-3 font-display text-2xl font-extrabold text-text-primary">{title}</h3>
      {description && (
        <p className="mx-auto mb-2 max-w-md text-sm leading-relaxed text-text-secondary">{description}</p>
      )}
      {hint && (
        <p className="mx-auto mb-7 max-w-md text-sm leading-relaxed text-text-disabled">{hint}</p>
      )}
      {actions && !hint && <div className="mt-6" />}
      {actions && (
        <div className="flex flex-wrap items-center justify-center gap-2.5">{actions}</div>
      )}
    </div>
  );
};
