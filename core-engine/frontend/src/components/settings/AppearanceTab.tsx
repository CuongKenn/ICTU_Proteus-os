// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ui/ThemeToggleProvider";

export const AppearanceTab = () => {
  const { theme, setTheme } = useTheme();

  const options = [
    { id: "light" as const, label: "Light Mode", icon: Sun, iconColor: "var(--amber)", iconBg: "var(--amber-fill)" },
    { id: "dark" as const, label: "Dark Mode", icon: Moon, iconColor: "var(--accent)", iconBg: "var(--accent-soft)" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-xl font-grot font-bold" style={{ color: "var(--ink)" }}>Appearance</h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Customize how Proteus OS looks on your device.
        </p>
      </div>

      <div>
        <h3 className="font-mono text-meta font-medium mb-4" style={{ color: "var(--dim)" }}>THEME PREFERENCES</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl transition-all"
              style={{
                background: theme === opt.id ? "var(--accent-soft)" : "transparent",
                border: `2px solid ${theme === opt.id ? "var(--accent)" : "var(--line-hi)"}`,
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: opt.iconBg, color: opt.iconColor, border: `1px solid ${opt.iconColor}22` }}
              >
                <opt.icon className="w-6 h-6" />
              </div>
              <span className="font-medium text-sm" style={{ color: "var(--ink)" }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
