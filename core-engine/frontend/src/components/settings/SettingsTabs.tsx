// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { User, Building2, Palette, Plug, ShieldCheck, Info, Users, KeySquare } from "lucide-react";
import { clsx } from "clsx";
import type { SettingsTabId } from "@/app/settings/SettingsClient";

interface SettingsTabsProps {
  activeTab: SettingsTabId;
  onChangeTab: (tab: SettingsTabId) => void;
}

export const SettingsTabs: React.FC<SettingsTabsProps> = ({ activeTab, onChangeTab }) => {
  const tabs: { id: SettingsTabId; label: string; hint: string; icon: React.ElementType }[] = [
    { id: "profile", label: "Hồ sơ", hint: "Thông tin cá nhân", icon: User },
    { id: "tenant", label: "Tổ chức", hint: "Tên, gói dịch vụ", icon: Building2 },
    { id: "users", label: "Nhân sự", hint: "Mời, phân quyền", icon: Users },
    { id: "roles", label: "Vai trò", hint: "Ma trận quyền", icon: KeySquare },
    { id: "appearance", label: "Giao diện", hint: "Sáng, tối, ngôn ngữ", icon: Palette },
    { id: "integrations", label: "Kết nối", hint: "API, webhook", icon: Plug },
    { id: "security", label: "Bảo mật", hint: "Mật khẩu, phiên", icon: ShieldCheck },
    { id: "about", label: "Giới thiệu", hint: "Phiên bản, sức khỏe", icon: Info },
  ];

  return (
    <nav aria-label="Cài đặt" className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-bg-glass p-2 backdrop-blur-glass">
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
              active
                ? "bg-brand-primary/10 font-bold text-brand-primary shadow-[inset_0_0_0_1px_hsla(245,85%,65%,0.25)]"
                : "font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            )}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate leading-tight">{tab.label}</span>
              <span className="block truncate text-[11px] font-normal leading-tight opacity-70">{tab.hint}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
};
