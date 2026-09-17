// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { SsoEmbed } from "@/components/ui/SsoEmbed";
import { AppWindow } from "lucide-react";

export default function AppsPage() {
  // Runtime env, fallback "" an toàn (không hardcode proteus.local).
  const appsUrl = process.env.NEXT_PUBLIC_APPSMITH_URL || "";

  return (
    <AppShell>
      {appsUrl ? (
        <SsoEmbed
          baseUrl={appsUrl}
          title="Low-code UI Builder (Appsmith)"
          storageKey="proteus:sso:apps:done"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-brand-primary/25 bg-gradient-to-br from-brand-primary/15 via-bg-surface to-brand-secondary/10">
            <AppWindow className="h-10 w-10 text-brand-primary" />
          </span>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-text-primary">Ứng dụng nội bộ</h1>
          <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
            Tích hợp Ứng dụng nội bộ chưa được cấu hình. Vui lòng liên hệ Admin để thiết lập.
          </p>
        </div>
      )}
    </AppShell>
  );
}
