// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { AIChatWidget } from "@/components/AIChatWidget";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const userRoles: string[] = session?.user?.roles ?? [];
  const isTenantAdmin = userRoles.includes("tenant_admin");

<<<<<<< HEAD
=======
  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/federated-logout");
      const data = await res.json();
      await signOut({ redirect: false });
      window.location.href = data.url || "/login";
    } catch {
      signOut({ callbackUrl: "/login" });
    }
  };

  const navigationLinks = [
    { name: "Launchpad", href: "/launchpad", icon: LayoutGrid, requiredRole: null },
    { name: "Chat", href: "/chat", icon: MessageSquare, requiredRole: null },
    { name: "Files", href: "/files", icon: FolderOpen, requiredRole: null },
    { name: "Wiki", href: "/wiki", icon: BookOpen, requiredRole: null },
    { name: "Marketplace", href: "/marketplace", icon: Package, requiredRole: "tenant_admin" },
    { name: "Settings", href: "/settings", icon: Settings, requiredRole: "tenant_admin" },
  ];

  const filteredLinks = navigationLinks.filter(
    (link) => !link.requiredRole || userRoles.includes(link.requiredRole)
  );
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base text-text-primary">
      <Sidebar 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen} 
        userRoles={userRoles} 
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
<<<<<<< HEAD
        <Topbar 
          toggleMobileMenu={toggleMobileMenu} 
          isTenantAdmin={isTenantAdmin} 
        />
=======
        {/* Top Navbar */}
        <header className="h-[56px] border-b border-border bg-bg-glass backdrop-blur-[12px] flex items-center justify-between px-4 shrink-0 z-30 relative">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-text-secondary hover:text-text-primary" onClick={toggleMobileMenu}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center text-sm text-text-secondary">
              <Link href="/launchpad" className="hover:text-primary transition-colors">
                Launchpad
              </Link>
              {pathname !== "/launchpad" && (
                <>
                  <span className="mx-2">/</span>
                  <span className="text-text-primary capitalize">
                    {pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ")}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notification Center */}
            <button className="relative p-2 text-text-secondary hover:bg-bg-hover rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full border border-bg-surface animate-pulse" />
            </button>

            <div className="w-px h-6 bg-border mx-1" />

            {/* User Profile */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-text-primary leading-none">
                  {session?.user?.name || "Người dùng"}
                </span>
                <span className="text-xs text-text-secondary mt-1">
                  {isTenantAdmin ? "Admin" : "Nhân viên"}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30 text-accent font-bold cursor-pointer">
                {(session?.user?.name || "U").charAt(0).toUpperCase()}
              </div>
              <Button 
                variant="ghost" 
                className="!p-2 text-danger hover:bg-danger/10 hover:text-danger rounded-full"
                onClick={handleLogout}
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>
>>>>>>> 92f8f14 (fix(frontend): implement federated logout via Keycloak (Issue #330))

        {/* Content Wrapper */}
        <main className="flex-1 overflow-auto bg-bg-base">
          {children}
        </main>
      </div>
      
      {/* AI Chat Widget (Floating) */}
      <AIChatWidget />
    </div>
  );
};
