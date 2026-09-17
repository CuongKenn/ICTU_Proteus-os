// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { ThemeToggleProvider } from "@/components/ui/ThemeToggleProvider";

// ThemeProvider wraps the ThemeToggleProvider for the entire app.
// The actual theme state and toggle logic lives in ThemeToggleProvider.
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ThemeToggleProvider>{children}</ThemeToggleProvider>;
};
