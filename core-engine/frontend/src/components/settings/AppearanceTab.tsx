// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState, useEffect } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { clsx } from "clsx";

export const AppearanceTab = () => {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    // In a real app, this would integrate with next-themes or a context
    const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    // Mocking the detection
  }, []);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (newTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      // System
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Appearance</h2>
        <p className="text-text-secondary text-sm mt-1">
          Customize how Proteus OS looks on your device.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-4">Theme Preferences</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleThemeChange("light")}
              className={clsx(
                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                theme === "light"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-bg-surface hover:border-text-secondary"
              )}
            >
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
                <Sun className="w-6 h-6" />
              </div>
              <span className="font-medium text-text-primary">Light Mode</span>
            </button>

            <button
              onClick={() => handleThemeChange("dark")}
              className={clsx(
                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                theme === "dark"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-bg-surface hover:border-text-secondary"
              )}
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                <Moon className="w-6 h-6" />
              </div>
              <span className="font-medium text-text-primary">Dark Mode</span>
            </button>

            <button
              onClick={() => handleThemeChange("system")}
              className={clsx(
                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                theme === "system"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-bg-surface hover:border-text-secondary"
              )}
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Monitor className="w-6 h-6" />
              </div>
              <span className="font-medium text-text-primary">System Match</span>
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <h3 className="text-sm font-medium text-text-primary mb-4">Language & Region</h3>
          <div className="grid gap-4 max-w-sm">
            <select className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="vi">Tiếng Việt (Vietnamese)</option>
              <option value="en">English (US)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
