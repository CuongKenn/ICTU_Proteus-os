// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { AppearanceTab } from "@/components/settings/AppearanceTab";
import { SecurityTab } from "@/components/settings/SecurityTab";
import { AboutTab } from "@/components/settings/AboutTab";
import { useSession } from "next-auth/react";

export type SettingsTabId = "profile" | "tenant" | "appearance" | "integrations" | "security" | "about";

export const SettingsClient = () => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("profile");
  const { data: session } = useSession();

  const renderActiveTab = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileTab session={session} />;
      case "appearance":
        return <AppearanceTab />;
      case "security":
        return <SecurityTab />;
      case "about":
        return <AboutTab />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-64 bg-bg-surface rounded-xl border border-border border-dashed">
            <Settings className="w-12 h-12 text-text-muted mb-4" />
            <p className="text-text-secondary">Tính năng này đang trong quá trình phát triển. Vui lòng quay lại sau.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full max-w-6xl mx-auto">
      {/* Sidebar Tabs */}
      <div className="w-full md:w-64 shrink-0">
        <SettingsTabs activeTab={activeTab} onChangeTab={setActiveTab} />
      </div>
      
      {/* Content Area */}
      <div className="flex-1 min-w-0">
        <div className="bg-bg-glass backdrop-blur-glass border border-border p-6 rounded-xl shadow-sm min-h-[500px]">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
};
