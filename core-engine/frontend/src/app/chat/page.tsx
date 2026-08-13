// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { IframeEmbed } from "@/components/ui/IframeEmbed";

export default function ChatPage() {
  return (
    <AppShell>
      <IframeEmbed
        src={process.env.NEXT_PUBLIC_MATTERMOST_URL || "http://localhost:8065"}
        title="Mattermost Chat"
      />
    </AppShell>
  );
}
