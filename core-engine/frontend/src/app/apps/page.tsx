// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { SsoEmbed } from "@/components/ui/SsoEmbed";
import { AppWindow } from "lucide-react";

export default function AppsPage() {
  const appsUrl = process.env.NEXT_PUBLIC_APPSMITH_URL || "http://apps.proteus.local";

  return (
    <AppShell>
      {appsUrl ? (
        <SsoEmbed
          baseUrl={appsUrl}
          title="Low-code UI Builder (Appsmith)"
          storageKey="proteus:sso:apps:done"
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-text-secondary">
          <AppWindow className="w-16 h-16 opacity-30" />
          <h1 className="text-2xl font-bold text-text-primary">Ứng dụng nội bộ</h1>
          <p>Tích hợp Ứng dụng nội bộ chưa được cấu hình. Vui lòng liên hệ Admin để thiết lập.</p>
        </div>
      )}
    </AppShell>
  );
}
