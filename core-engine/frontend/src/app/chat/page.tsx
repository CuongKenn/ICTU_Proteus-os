// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { SsoEmbed } from "@/components/ui/SsoEmbed";

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

export default function ChatPage() {
  // Đọc env tại runtime; fallback "" an toàn thay vì hardcode proteus.local.
  // Nếu thiếu config, SsoEmbed sẽ hiện thông báo thay vì trỏ nhầm domain.
  const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || "";

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
