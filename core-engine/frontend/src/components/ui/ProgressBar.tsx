// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import clsx from "clsx";

export interface ProgressBarProps {
  progress: number;
  label?: string;
  status?: "installing" | "failed";
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label, status = "installing" }) => {
  const safeProgress = Math.min(Math.max(progress, 0), 100);
  
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-text-secondary mb-1">
          <span>{label}</span>
          <span>{safeProgress}%</span>
        </div>
      )}
      <div className="h-2 w-full bg-bg-surface border border-border rounded-full overflow-hidden">
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-300 ease-linear",
            status === "installing" ? "bg-warning" : "bg-danger"
          )}
          style={{ width: `${safeProgress}%` }}
        />
      </div>
    </div>
  );
};
