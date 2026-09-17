// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Store,
  Settings,
  MessageSquare,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "launchpad", label: "Dashboard", icon: LayoutDashboard, href: "/launchpad" },
  { id: "marketplace", label: "Marketplace", icon: Store, href: "/marketplace" },
  { id: "chat", label: "Mattermost", icon: MessageSquare, href: "/chat" },
  { id: "wiki", label: "Outline Wiki", icon: FileText, href: "/wiki" },
  { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        "hidden md:flex flex-col h-full shrink-0 transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
      style={{
        background: "var(--paper-raised)",
        borderRight: "1px solid var(--line)",
      }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 shrink-0" style={{ borderBottom: "1px solid var(--line)" }}>
        <Link href="/launchpad" className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-grot font-bold text-white text-sm shrink-0" style={{ background: "var(--accent)" }}>P</div>
          {!collapsed && (
            <span className="font-grot text-base font-semibold tracking-tight whitespace-nowrap" style={{ color: "var(--ink)" }}>
              Proteus <span style={{ color: "var(--accent)" }}>OS</span>
            </span>
          )}
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        <div className="mb-2 px-3">
          {!collapsed && (
            <span className="font-mono text-meta font-medium" style={{ color: "var(--dim)" }}>NAVIGATION</span>
          )}
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.id}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-lg transition-all duration-200",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
              )}
              style={{
                background: isActive ? "var(--accent-soft)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--muted)",
                fontWeight: isActive ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--accent-soft)";
                  e.currentTarget.style.color = "var(--accent)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--muted)";
                }
              }}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span className="text-[13px]">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-10 flex items-center justify-center shrink-0 transition-colors"
        style={{ borderTop: "1px solid var(--line)", color: "var(--dim)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--dim)")}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
