// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { AIChatWidget } from "@/components/AIChatWidget";
import { useSession } from "next-auth/react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto" style={{ background: "var(--paper)" }}>
          {children}
        </main>
      </div>
      {session && <AIChatWidget />}
    </div>
  );
}
