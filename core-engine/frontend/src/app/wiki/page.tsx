// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { SsoEmbed } from "@/components/ui/SsoEmbed";
import { BookOpen } from "lucide-react";

export default function WikiPage() {
  const wikiUrl = process.env.NEXT_PUBLIC_OUTLINE_URL || "";

  return (
    <AppShell>
      {wikiUrl ? (
        <SsoEmbed
          baseUrl={wikiUrl}
          // Outline khởi động luồng OIDC tại /auth/oidc → Keycloak realm proteus.
          ssoUrl={`${wikiUrl.replace(/\/+$/, "")}/auth/oidc`}
          title="Outline Wiki"
          storageKey="proteus-sso-outline"
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-text-secondary">
          <BookOpen className="w-16 h-16 opacity-30" />
          <p className="mt-4 text-text-secondary">
            Tích hợp Wiki chưa được cấu hình. Vui lòng liên hệ Admin để thiết lập.
          </p>
        </div>
      )}
    </AppShell>
  );
}
