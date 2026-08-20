// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { 
  X, 
  Package, 
  LayoutGrid, 
  MessageSquare,
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

  useEffect(() => {
    const saved = localStorage.getItem("proteus_sidebar_collapsed");
    if (saved) setIsCollapsed(saved === "true");
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    localStorage.setItem("proteus_sidebar_collapsed", String(!isCollapsed));
  };

  const PRODUCTIVITY_LINKS = [
    { name: "Launchpad", href: "/launchpad", icon: LayoutGrid, requiredRole: null },
    { name: "Trò chuyện", href: "/chat", icon: MessageSquare, requiredRole: null },
    { name: "Ứng dụng", href: "/apps", icon: AppWindow, requiredRole: null },
    { name: "Tài liệu", href: "/wiki", icon: BookOpen, requiredRole: null },
  ];

  const ADMIN_LINKS = [
    { name: "Marketplace", href: "/marketplace", icon: Package, requiredRole: "tenant_admin" },
    { name: "Cài đặt", href: "/settings", icon: Settings, requiredRole: "tenant_admin" },
  ];

  const filterLinks = (links: any[]) => links.filter(
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
            className={clsx("flex items-center gap-2 font-bold text-lg text-white hover:opacity-80 transition-opacity overflow-hidden", isCollapsed ? "w-8" : "w-auto")}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
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
            {!isCollapsed && <div className="px-3 text-xs font-semibold text-text-disabled uppercase tracking-wider mb-2">Công việc</div>}
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
              {!isCollapsed && <div className="px-3 text-xs font-semibold text-text-disabled uppercase tracking-wider mb-2">Quản trị</div>}
              <div className="space-y-1">
                {filterLinks(ADMIN_LINKS).map((link) => {
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
          )}
        </nav>

        {/* User Profile Section */}
        <div className="border-t border-border p-3">
          <div className={clsx("flex items-center gap-3 rounded-lg hover:bg-bg-hover p-2 transition-colors cursor-pointer", isCollapsed && "justify-center")}>
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-accent" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">
                  {session?.user?.name || "Người dùng"}
                </div>
                <div className="text-xs text-text-disabled truncate">
                  {userRoles.includes("tenant_admin") ? "Admin" : "Thành viên"}
                </div>
              </div>
            )}
          </div>
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
