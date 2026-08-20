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
  ChevronLeft,
  ChevronRight,
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
    const stored = localStorage.getItem("proteus_sidebar_collapsed");
    if (stored === "true") setIsCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    const newVal = !isCollapsed;
    setIsCollapsed(newVal);
    localStorage.setItem("proteus_sidebar_collapsed", String(newVal));
  };

  const CORE_LINKS = [
    { name: "Launchpad", href: "/launchpad", icon: LayoutGrid, requiredRole: null },
    { name: "Chat", href: "/chat", icon: MessageSquare, requiredRole: null },
    { name: "Apps", href: "/apps", icon: AppWindow, requiredRole: null, tooltip: "Low-code Application Builder (Appsmith)" },
    { name: "Wiki", href: "/wiki", icon: BookOpen, requiredRole: null },
  ];

  const ADMIN_LINKS = [
    { name: "Marketplace", href: "/marketplace", icon: Package, requiredRole: "tenant_admin" },
    { name: "Settings", href: "/settings", icon: Settings, requiredRole: "tenant_admin" },
  ];

  const filterLinks = (links: any[]) => 
    links.filter((link) => !link.requiredRole || userRoles.includes(link.requiredRole));

  return (
    <>
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 bg-bg-glass backdrop-blur-glass border-r border-border transition-all duration-300 ease-in-out flex flex-col md:relative",
          isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0",
          isCollapsed ? "md:w-16" : "md:w-64"
        )}
      >
        <div className="h-full flex flex-col overflow-hidden">
          <div className="h-[56px] flex items-center justify-between px-4 border-b border-border shrink-0">
            <Link href="/launchpad" className={clsx("flex items-center gap-2 font-bold text-lg text-primary hover:opacity-80 transition-opacity", isCollapsed ? "mx-auto px-0" : "")}>
              <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm">
                <span className="text-white font-black text-sm">Pr</span>
              </div>
              {!isCollapsed && <span className="whitespace-nowrap">Proteus OS</span>}
            </Link>
            <button className="md:hidden text-text-secondary hover:text-text-primary" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
            <div>
              {!isCollapsed && <p className="px-3 text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Productivity</p>}
              <div className="space-y-1">
                {filterLinks(CORE_LINKS).map((link) => {
                  const isActive = pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      title={link.name}
                      className={clsx(
                        "flex items-center rounded-md transition-colors",
                        isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2",
                        isActive ? "bg-primary/10 text-primary font-medium" : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
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

            {filterLinks(ADMIN_LINKS).length > 0 && (
              <div>
                {!isCollapsed && <p className="px-3 text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Administration</p>}
                <div className="space-y-1">
                  {filterLinks(ADMIN_LINKS).map((link) => {
                    const isActive = pathname.startsWith(link.href);
                    return (
                      <Link
                        key={link.name}
                        href={link.href}
                        title={link.name}
                        className={clsx(
                          "flex items-center rounded-md transition-colors",
                          isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2",
                          isActive ? "bg-primary/10 text-primary font-medium" : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
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

          <div className="border-t border-border p-3 flex items-center justify-between">
            <div className={clsx("flex items-center gap-3 overflow-hidden", isCollapsed ? "justify-center w-full" : "")}>
              <div className="w-9 h-9 shrink-0 rounded-full bg-bg-surface-elevated border border-border flex items-center justify-center">
                <User className="w-5 h-5 text-text-secondary" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium text-text-primary truncate">{session?.user?.name || "User"}</span>
                  <span className="text-xs text-text-muted truncate">{session?.user?.email || "user@example.com"}</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={toggleCollapse}
            className="hidden md:flex absolute -right-3 top-20 w-6 h-6 bg-bg-surface border border-border rounded-full items-center justify-center text-text-secondary hover:text-primary hover:border-primary transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
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
