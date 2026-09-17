// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { 
  X, 
  Package, 
  LayoutGrid, 
  MessageSquare,
  Bot,
  AppWindow,
  BookOpen,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Cpu,
  LogOut,
  User
} from "lucide-react";
import { clsx } from "clsx";

interface SidebarProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  userRoles: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileMenuOpen, setIsMobileMenuOpen, userRoles }) => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);


  const handleLogout = async () => {
    // Xóa cờ SSO đã xong để lần login sau toolbar hiện lại nếu cần.
    try {
      localStorage.removeItem("proteus:sso:chat:done");
      localStorage.removeItem("proteus:sso:wiki:done");
      localStorage.removeItem("proteus:sso:apps:done");
    } catch {
      // Bỏ qua.
    }
    // 1. Thu hồi Mattermost sessions (best-effort, khi BFF session còn hạn).
    // Nếu không, user logout hệ thống nhưng chat vẫn còn session cũ.
    try {
      const { default: api } = await import("@/lib/api");
      await api.post("/v1/auth/logout");
    } catch {
      // MM down cũng không chặn logout hệ thống.
    }
    // 2. Federated Logout: đăng xuất khỏi cả NextAuth lẫn Keycloak SSO session
    // Nếu không làm bước này, Keycloak vẫn nhớ session và tự login lại ngay
    const res = await fetch("/api/auth/federated-logout");
    const data = await res.json();
    // Xóa NextAuth session trước, rồi redirect sang Keycloak end_session endpoint
    await signOut({ redirect: false });
    window.location.href = data.url ?? "/login";
  };

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("proteus_sidebar_collapsed");
    if (saved) setIsCollapsed(saved === "true");
  }, []);


  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    localStorage.setItem("proteus_sidebar_collapsed", String(!isCollapsed));
  };

  const PRODUCTIVITY_LINKS = [
    { name: "Launchpad", href: "/launchpad", icon: LayoutGrid, requiredRole: null },
    { name: "Proteus AI", href: "/ai", icon: Bot, requiredRole: null },
    { name: "Trò chuyện", href: "/chat", icon: MessageSquare, requiredRole: null },
    { name: "Ứng dụng", href: "/apps", icon: AppWindow, requiredRole: null },
    { name: "Tài liệu", href: "/wiki", icon: BookOpen, requiredRole: null },
  ];

  const ADMIN_LINKS = [
    { name: "Marketplace", href: "/marketplace", icon: Package, requiredRole: "tenant_admin" },
    { name: "Cài đặt", href: "/settings", icon: Settings, requiredRole: "tenant_admin" },
  ];

  interface NavLink {
    name: string;
    href: string;
    icon: React.ElementType;
    requiredRole: string | null;
  }

  const filterLinks = (links: NavLink[]) => links.filter(
    (link) => !link.requiredRole || userRoles.includes(link.requiredRole)
  );

  return (
    <>
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 bg-bg-glass backdrop-blur-glass border-r border-border transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        {/* Header */}
        <div className="h-[56px] flex items-center justify-between px-4 border-b border-border shrink-0">
          <Link 
            href="/launchpad" 
            className={clsx("flex items-center gap-2 font-display font-bold text-lg text-slate-900 hover:opacity-80 transition-opacity overflow-hidden dark:text-white", isCollapsed ? "w-8" : "w-auto")}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shrink-0 shadow-sm">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && <span className="whitespace-nowrap">Proteus OS</span>}
          </Link>
          <div className="flex items-center">
            <button className="hidden md:flex text-text-secondary hover:text-text-primary" onClick={toggleCollapse}>
              {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
            <button className="md:hidden text-text-secondary hover:text-text-primary" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {/* Productivity */}
          <div>
            {!isCollapsed && <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 dark:text-text-disabled">Công việc</div>}
            <div className="space-y-1">
              {filterLinks(PRODUCTIVITY_LINKS).map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    title={link.name}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors group relative",
                      isActive 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                      isCollapsed && "justify-center"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <link.icon className="w-5 h-5 shrink-0" />
                    {!isCollapsed && <span>{link.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Admin */}
          {filterLinks(ADMIN_LINKS).length > 0 && (
            <div>
              {!isCollapsed && <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 dark:text-text-disabled">Quản trị</div>}
              <div className="space-y-1">
                {filterLinks(ADMIN_LINKS).map((link) => {
                  const isActive = pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      title={link.name}
                      className={clsx(
                        "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                        isActive 
                          ? "bg-indigo-600/[0.08] text-indigo-700 font-bold shadow-[inset_0_0_0_1px_rgba(79,70,229,0.15)] dark:bg-primary/10 dark:text-primary dark:shadow-none" 
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-text-secondary dark:hover:bg-bg-hover dark:hover:text-text-primary",
                        isCollapsed && "justify-center"
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <link.icon className="w-5 h-5 shrink-0" />
                      {!isCollapsed && <span>{link.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* User Profile Section */}
        <div className="border-t border-border p-3">
          <div className={clsx("flex items-center justify-between gap-2 rounded-lg hover:bg-bg-hover p-2 transition-colors cursor-pointer", isCollapsed && "justify-center")}>
            <div className="flex items-center gap-3 min-w-0" title={isCollapsed ? (session?.user?.name || "Người dùng") : undefined}>
              <div className="w-8 h-8 rounded-full bg-fuchsia-600/10 border border-fuchsia-600/20 flex items-center justify-center shrink-0 dark:bg-accent/20 dark:border-accent/30">
                <User className="w-4 h-4 text-fuchsia-700 dark:text-accent" />
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {session?.user?.name || "Người dùng"}
                  </div>
                  <div className="text-xs text-text-disabled truncate">
                    {isMounted && userRoles.includes("tenant_admin") ? "Admin" : isMounted ? "Thành viên" : ""}

                  </div>
                </div>
              )}
            </div>
            
            {!isCollapsed && (
              <button 
                onClick={handleLogout}
                className="p-1.5 text-text-disabled hover:text-error hover:bg-error/10 rounded-md transition-colors shrink-0"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Show a separate logout button below if collapsed */}
          {isCollapsed && (
            <div className="mt-2 flex justify-center">
              <button 
                onClick={handleLogout}
                className="p-2 text-text-disabled hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
};
