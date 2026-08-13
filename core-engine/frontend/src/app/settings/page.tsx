// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { Building2, Bell, Shield, Info } from "lucide-react";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary">Settings</h1>
          <p className="text-text-secondary mt-2">Manage your workspace preferences and security configurations.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tenant Info */}
          <section className="bg-bg-glass backdrop-blur-glass border border-border p-6 rounded-xl shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Building2 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary">Workspace Profile</h2>
            </div>
            <div className="space-y-4 text-sm text-text-secondary">
              <p>Configure your organization&apos;s name, logo, and primary timezone.</p>
              <div className="h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-bg-surface">
                <span className="opacity-50">Profile configurations coming soon...</span>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section className="bg-bg-glass backdrop-blur-glass border border-border p-6 rounded-xl shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-success/10 rounded-lg text-success">
                <Bell className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary">Notifications</h2>
            </div>
            <div className="space-y-4 text-sm text-text-secondary">
              <p>Manage how and when you receive alerts from Proteus OS and Mattermost.</p>
              <div className="h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-bg-surface">
                <span className="opacity-50">Notification preferences coming soon...</span>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="bg-bg-glass backdrop-blur-glass border border-border p-6 rounded-xl shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-warning/10 rounded-lg text-warning">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary">Security</h2>
            </div>
            <div className="space-y-4 text-sm text-text-secondary">
              <p>Manage active sessions, two-factor authentication, and API tokens.</p>
              <div className="h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-bg-surface">
                <span className="opacity-50">Security settings coming soon...</span>
              </div>
            </div>
          </section>

          {/* About */}
          <section className="bg-bg-glass backdrop-blur-glass border border-border p-6 rounded-xl shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-accent/10 rounded-lg text-accent">
                <Info className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary">About Proteus OS</h2>
            </div>
            <div className="space-y-4 text-sm text-text-secondary">
              <p>System information, versions, and licensing details.</p>
              <div className="h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center bg-bg-surface">
                <span className="font-bold text-text-primary">v0.1.0-alpha</span>
                <span className="opacity-50 mt-1">AGPL-3.0-or-later License</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
