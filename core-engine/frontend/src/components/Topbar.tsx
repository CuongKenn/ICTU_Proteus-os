// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Bell, Search, LogOut, User, ChevronDown } from "lucide-react";
import { NotificationPanel } from "@/components/NotificationPanel";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import api from "@/lib/api";

export function Topbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Đăng xuất toàn phần: thu hồi Mattermost sessions (backend) →
  // federated logout Keycloak (xóa SSO cookie) → xóa local session.
  // Trước đây chỉ signOut local nên SSO cookie còn → vào lại không hỏi pass.
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setShowUserMenu(false);
    try {
      // 1. Thu hồi Mattermost sessions — best-effort, cần gọi khi
      // NextAuth session vẫn còn hạn (sau signOut là 401).
      await api.post("/v1/auth/logout").catch(() => null);
      // 2. Lấy Keycloak end_session URL (kèm id_token_hint).
      const res = await fetch("/api/auth/federated-logout")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const url = res?.url;
      if (url && url !== "/login") {
        // 3. Xóa local session (không redirect vội) rồi nhảy sang
        // Keycloak logout để xóa SSO cookie, Keycloak tự redirect về /login.
        await signOut({ redirect: false }).catch(() => null);
        window.location.href = url;
        return;
      }
    } catch {
      // Rơi xuống fallback local signOut bên dưới.
    }
    await signOut({ callbackUrl: "/login" });
    setLoggingOut(false);
  };

  const pageTitle = (() => {
    if (pathname.startsWith("/launchpad")) return "Dashboard";
    if (pathname.startsWith("/ai")) return "Proteus AI";
    if (pathname.startsWith("/marketplace")) return "Marketplace";
    if (pathname.startsWith("/settings")) return "Settings";
    if (pathname.startsWith("/chat")) return "Mattermost";
    if (pathname.startsWith("/wiki")) return "Outline Wiki";
    return "Proteus OS";
  })();

  return (
    <header
      className="h-14 flex items-center justify-between px-4 md:px-6 shrink-0"
      style={{ background: "var(--paper-raised)", borderBottom: "1px solid var(--line)" }}
    >
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-meta" style={{ color: "var(--dim)" }}>proteus-os</span>
        <span style={{ color: "var(--ghost)" }}>/</span>
        <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>{pageTitle}</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
          >
            <Bell className="w-[18px] h-[18px]" />
          </button>
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-full mt-2 z-50">
                <NotificationPanel onClose={() => setShowNotifications(false)} />
              </div>
            </>
          )}
        </div>

        {/* User Menu */}
        {session?.user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors"
              style={{ color: "var(--ink)" }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                {session.user.name?.charAt(0) || "U"}
              </div>
              <span className="text-[13px] font-medium hidden lg:inline" style={{ color: "var(--ink)" }}>
                {session.user.name}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${showUserMenu ? "rotate-180" : ""}`}
                style={{ color: "var(--dim)" }}
              />
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl py-1 z-50 animate-scale-in origin-top-right"
                  style={{ background: "var(--paper-raised)", border: "1px solid var(--line-hi)", boxShadow: "var(--shadow-elevated)" }}
                >
                  <div className="px-3.5 py-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
                    <p className="text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>{session.user.name}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--dim)" }}>{session.user.email}</p>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="w-full text-left px-3 py-2 text-[13px] rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60"
                      style={{ color: "var(--rose)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rose-fill)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <LogOut className="w-4 h-4" />
                      {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
