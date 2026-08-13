// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { IframeEmbed } from "@/components/ui/IframeEmbed";
import { AppWindow } from "lucide-react";

export default function AppsPage() {
  const appsUrl = process.env.NEXT_PUBLIC_APPSMITH_URL;

  return (
    <AppShell>
      {appsUrl ? (
        <IframeEmbed
          src={appsUrl}
          title="Low-code UI Builder (Appsmith)"
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-text-secondary">
          <AppWindow className="w-16 h-16 opacity-30" />
          <h1 className="text-2xl font-bold text-text-primary">Low-code Apps</h1>
          <p>The Appsmith integration is currently disabled or not configured properly.</p>
        </div>
      )}
    </AppShell>
  );
}
