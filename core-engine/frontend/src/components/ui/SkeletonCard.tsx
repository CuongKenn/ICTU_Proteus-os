// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";

export const SkeletonCard: React.FC = () => (
  <div className="card p-5 animate-pulse">
    {/* Header */}
    <div className="flex items-start gap-3.5">
      <div className="plugin-icon" style={{ background: "var(--line)" }} />
      <div className="flex-1 space-y-2.5">
        <div className="h-4 rounded-lg w-3/4" style={{ background: "var(--line)" }} />
        <div className="h-3 rounded-lg w-1/3" style={{ background: "var(--line)" }} />
        <div className="flex gap-1.5 mt-1">
          <div className="h-[18px] rounded-md w-10" style={{ background: "var(--line)" }} />
          <div className="h-[18px] rounded-md w-14" style={{ background: "var(--line)" }} />
        </div>
      </div>
    </div>
    {/* Description */}
    <div className="mt-3 space-y-2">
      <div className="h-3 rounded-lg w-full" style={{ background: "var(--line)" }} />
      <div className="h-3 rounded-lg w-2/3" style={{ background: "var(--line)" }} />
    </div>
    {/* Separator */}
    <div className="separator mt-3" />
    {/* Action */}
    <div className="mt-3 h-9 rounded-lg" style={{ background: "var(--line)" }} />
  </div>
);
