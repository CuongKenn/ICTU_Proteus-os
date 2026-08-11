// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";

export default function ChatPage() {
  return (
    <AppShell>
      <iframe
        src={process.env.NEXT_PUBLIC_MATTERMOST_URL || "http://localhost:8065"}
        className="w-full h-full border-0"
        title="Mattermost Chat"
      />
    </AppShell>
  );
}
