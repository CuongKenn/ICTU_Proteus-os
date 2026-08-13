// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";

export interface AppIconProps {
  appName: string;
  icon: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
}

export const AppIcon: React.FC<AppIconProps> = ({ appName, icon, isActive = false, onClick }) => {
  return (
    <div 
      role="button"
      tabIndex={0}
      className="flex flex-col items-center gap-2 cursor-pointer group w-24 outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="relative w-20 h-20 rounded-[20px] glass-card flex items-center justify-center text-3xl transition-all duration-[200ms] ease-[cubic-bezier(0.175,0.885,0.32,1.275)] group-hover:scale-105 group-hover:shadow-[0_0_20px_hsla(245,85%,65%,0.3)]">
        {icon}
      </div>
      <div className="text-sm text-center text-text-primary line-clamp-2 font-medium">
        {appName}
      </div>
      {isActive && (
        <div className="flex items-center text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded-full border border-success/20 uppercase font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-success mr-1 animate-pulse" />
          Active
        </div>
      )}
    </div>
  );
};
