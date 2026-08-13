"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  X, 
  Package, 
  LayoutGrid, 
  MessageSquare,
  AppWindow,
  BookOpen,
  Settings
} from "lucide-react";
import { clsx } from "clsx";

interface SidebarProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  userRoles: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileMenuOpen, setIsMobileMenuOpen, userRoles }) => {
  const pathname = usePathname();

  const navigationLinks = [
    { name: "Launchpad", href: "/launchpad", icon: LayoutGrid, requiredRole: null },
    { name: "Chat", href: "/chat", icon: MessageSquare, requiredRole: null },
    { name: "Apps", href: "/apps", icon: AppWindow, requiredRole: null, tooltip: "Low-code Application Builder (Appsmith)" },
    { name: "Wiki", href: "/wiki", icon: BookOpen, requiredRole: null },
    { name: "Marketplace", href: "/marketplace", icon: Package, requiredRole: "tenant_admin" },
    { name: "Settings", href: "/settings", icon: Settings, requiredRole: "tenant_admin" },
  ];

  const filteredLinks = navigationLinks.filter(
    (link) => !link.requiredRole || userRoles.includes(link.requiredRole)
  );

  return (
    <>
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-64 bg-bg-glass backdrop-blur-glass border-r border-border transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="h-[56px] flex items-center justify-between px-4 border-b border-border shrink-0">
            <Link href="/launchpad" className="flex items-center gap-2 font-bold text-lg text-primary hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                <span className="text-primary font-black">P</span>
              </div>
              Proteus OS
            </Link>
            <button className="md:hidden text-text-secondary hover:text-text-primary" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {filteredLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  title={link.tooltip || link.name}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                    isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <link.icon className="w-5 h-5 shrink-0" />
                  {link.name}
                </Link>
              );
            })}
          </nav>
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
