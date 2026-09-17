// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { Settings, SlidersHorizontal } from "lucide-react";
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
      case "profile":
        return <ProfileTab session={session} />;
      case "tenant":
        return <TenantTab />;
      case "users":
        return <UsersTab />;
      case "roles":
        return <RolesTab />;
      case "integrations":
        return <IntegrationsTab />;
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
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="relative mb-6 overflow-hidden rounded-[28px] border border-slate-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:p-7 dark:border-border/60 dark:bg-gradient-to-br dark:from-bg-surface dark:via-bg-surface/80 dark:to-bg-base dark:shadow-none">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-indigo-200/50 blur-[70px] dark:bg-brand-primary/15" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-[0_10px_24px_-10px_rgba(79,70,229,0.7)] dark:bg-gradient-to-br dark:from-brand-primary dark:to-brand-secondary dark:shadow-[0_8px_20px_-6px_hsla(245,85%,65%,0.6)]">
            <SlidersHorizontal className="h-6 w-6 text-white" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 text-balance sm:text-3xl dark:text-text-primary">
              Cài đặt hệ thống
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-text-secondary">
              Quản lý hồ sơ, tổ chức, nhân sự, giao diện và các kết nối của bạn.
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-6 md:flex-row">
        {/* Sidebar Tabs */}
        <div className="w-full shrink-0 md:sticky md:top-4 md:w-64 md:self-start">
          <SettingsTabs activeTab={activeTab} onChangeTab={setActiveTab} />
        </div>
        
        {/* Content Area */}
        <div className="min-w-0 flex-1">
          <div className="min-h-[500px] rounded-[20px] border border-slate-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.05)] dark:border-border/60 dark:bg-bg-glass dark:shadow-sm dark:backdrop-blur-glass">
            {renderActiveTab()}
          </div>
        </div>
      </div>
    </div>
  );
};
