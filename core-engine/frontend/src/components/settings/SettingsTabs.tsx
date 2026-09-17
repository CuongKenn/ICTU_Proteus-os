// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { User, Building2, Palette, Blocks, Shield, Info, Users } from "lucide-react";
import type { SettingsTabId } from "@/app/settings/SettingsClient";

interface SettingsTabsProps {
  activeTab: SettingsTabId;
  onChangeTab: (tab: SettingsTabId) => void;
}

export const SettingsTabs: React.FC<SettingsTabsProps> = ({ activeTab, onChangeTab }) => {
  const tabs: { id: SettingsTabId; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "tenant", label: "Organization", icon: Building2 },
    { id: "users", label: "Users", icon: Users },
    { id: "roles", label: "Roles", icon: Shield },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "integrations", label: "Integrations", icon: Blocks },
    { id: "security", label: "Security", icon: Shield },
    { id: "about", label: "About", icon: Info },
  ];

  return (
    <div className="card p-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChangeTab(tab.id)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all text-left w-full"
          style={{
            background: activeTab === tab.id ? "var(--accent-soft)" : "transparent",
            color: activeTab === tab.id ? "var(--accent)" : "var(--muted)",
            fontWeight: activeTab === tab.id ? 600 : 400,
          }}
          onMouseEnter={(e) => {
            if (activeTab !== tab.id) {
              e.currentTarget.style.background = "var(--accent-soft)";
              e.currentTarget.style.color = "var(--accent)";
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.id) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--muted)";
            }
          }}
        >
          <tab.icon className="w-4 h-4 shrink-0" />
          {tab.label}
        </button>
      ))}
    </div>
  );
};
