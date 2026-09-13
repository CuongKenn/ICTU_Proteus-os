// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { SsoEmbed } from "@/components/ui/SsoEmbed";

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

export default function ChatPage() {
  const baseUrl =
    process.env.NEXT_PUBLIC_MATTERMOST_URL || "http://chat.proteus.local";

  return (
    <AppShell>
      <SsoEmbed
        baseUrl={baseUrl}
        ssoUrl={joinUrl(baseUrl, "/oauth/gitlab/login")}
        title="Mattermost Chat"
        storageKey="proteus:sso:chat:done"
      />
    </AppShell>
  );
}
