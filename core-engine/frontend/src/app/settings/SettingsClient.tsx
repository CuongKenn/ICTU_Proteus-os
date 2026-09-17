// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { Settings } from "lucide-react";
import { AppearanceTab } from "@/components/settings/AppearanceTab";
import { TenantTab } from "@/components/settings/TenantTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { SecurityTab } from "@/components/settings/SecurityTab";
import { AboutTab } from "@/components/settings/AboutTab";
import { UsersTab } from "@/components/settings/UsersTab";
import { RolesTab } from "@/components/settings/RolesTab";
import { useSession } from "next-auth/react";

export type SettingsTabId = "profile" | "tenant" | "users" | "roles" | "appearance" | "integrations" | "security" | "about";

export const SettingsClient = () => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("profile");
  const { data: session } = useSession();

  const renderActiveTab = () => {
    switch (activeTab) {
      case "profile": return <ProfileTab session={session} />;
      case "tenant": return <TenantTab />;
      case "users": return <UsersTab />;
      case "roles": return <RolesTab />;
      case "integrations": return <IntegrationsTab />;
      case "appearance": return <AppearanceTab />;
      case "security": return <SecurityTab />;
      case "about": return <AboutTab />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-64 rounded-xl" style={{ border: "1px dashed var(--line-hi)" }}>
            <Settings className="w-12 h-12 mb-4" style={{ color: "var(--ghost)" }} />
            <p style={{ color: "var(--muted)" }}>Tính năng này đang trong quá trình phát triển.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full max-w-[1200px] mx-auto p-6 md:p-8">
      <div className="w-full md:w-64 shrink-0">
        <SettingsTabs activeTab={activeTab} onChangeTab={setActiveTab} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="card p-6 min-h-[500px]">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
};
