"use client";

import React from "react";
import { User, Building2, Palette, Blocks, Shield, Info } from "lucide-react";
import { clsx } from "clsx";
import type { SettingsTabId } from "@/app/settings/SettingsClient";

interface SettingsTabsProps {
  activeTab: SettingsTabId;
  onChangeTab: (tab: SettingsTabId) => void;
}

export const SettingsTabs: React.FC<SettingsTabsProps> = ({ activeTab, onChangeTab }) => {
  const tabs: { id: SettingsTabId; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "tenant", label: "Organization", icon: Building2 },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "integrations", label: "Integrations", icon: Blocks },
    { id: "security", label: "Security", icon: Shield },
    { id: "about", label: "About", icon: Info },
  ];

  return (
    <div className="flex flex-col gap-1 bg-bg-glass backdrop-blur-glass p-2 rounded-xl border border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChangeTab(tab.id)}
          className={clsx(
            "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
            activeTab === tab.id
              ? "bg-primary/10 text-primary"
              : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          )}
        >
          <tab.icon className="w-4 h-4 shrink-0" />
          {tab.label}
        </button>
      ))}
    </div>
  );
};
