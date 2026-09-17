// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";

interface ProgressBarProps {
  progress: number;
  label?: string;
  status?: "installing" | "default";
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label, status = "default" }) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <div className="flex justify-between text-[11px] font-medium" style={{ color: "var(--accent)" }}>
          <span>{label}</span>
          <span>{progress}%</span>
        </div>
      )}
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--line)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(progress, 100)}%`,
            background: "var(--accent)",
          }}
        />
      </div>
    </div>
  );
};
