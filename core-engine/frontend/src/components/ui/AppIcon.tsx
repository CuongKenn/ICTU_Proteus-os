// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { clsx } from "clsx";

interface AppIconProps {
  appName: string;
  icon: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
}

export const AppIcon: React.FC<AppIconProps> = ({ appName, icon, onClick, isActive = true }) => {
  return (
    <button
      onClick={onClick}
      disabled={!isActive}
      className="flex flex-col items-center gap-2 w-24 group"
    >
      <div
        className={clsx(
          "w-[72px] h-[72px] rounded-2xl flex items-center justify-center transition-all duration-300",
          isActive
            ? "cursor-pointer group-hover:shadow-card-hover group-hover:-translate-y-1"
            : "opacity-50 cursor-not-allowed grayscale"
        )}
        style={{
          background: "var(--paper-white)",
          border: "1px solid var(--line-hi)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {icon}
      </div>
      <span
        className="text-xs font-medium text-center truncate w-full"
        style={{ color: "var(--ink-soft)" }}
      >
        {appName}
      </span>
    </button>
  );
};
