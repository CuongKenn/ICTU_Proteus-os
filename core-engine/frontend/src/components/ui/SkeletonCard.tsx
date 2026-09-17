// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import clsx from "clsx";

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={clsx("glass-card p-4 flex flex-col gap-4 animate-pulse-slow", className)}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-bg-surface/50 border border-border/50 shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-bg-surface/60 rounded w-3/4" />
          <div className="h-3 bg-bg-surface/40 rounded w-1/4" />
        </div>
      </div>
      <div className="space-y-2 mt-2">
        <div className="h-3 bg-bg-surface/40 rounded w-full" />
        <div className="h-3 bg-bg-surface/40 rounded w-5/6" />
      </div>
      <div className="mt-auto pt-4 flex gap-4">
        <div className="h-10 bg-bg-surface/50 rounded-lg w-28" />
      </div>
    </div>
  );
};
