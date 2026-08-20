// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Bell, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface TopbarProps {
  toggleMobileMenu: () => void;
  isTenantAdmin: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ toggleMobileMenu, isTenantAdmin }) => {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [hasNotification, setHasNotification] = React.useState(true);

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

  return (
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
        <button 
          className="relative p-2 text-text-secondary hover:bg-bg-hover rounded-full transition-colors"
          onClick={() => {
            if (hasNotification) {
              setHasNotification(false);
              addToast("info", "Không có thông báo mới.");
            }
          }}
        >
          <Bell className="w-5 h-5" />
          {hasNotification && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full border border-bg-surface animate-pulse" />
          )}
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
  );
};
