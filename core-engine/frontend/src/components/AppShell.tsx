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

  // Roles được inject từ Keycloak JWT payload qua NextAuth jwt() callback
  const userRoles: string[] = session?.user?.roles ?? [];
  const isTenantAdmin = userRoles.includes("tenant_admin");

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
        <Topbar 
          toggleMobileMenu={toggleMobileMenu} 
          isTenantAdmin={isTenantAdmin} 
        />
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
