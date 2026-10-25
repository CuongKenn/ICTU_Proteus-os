// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { SsoEmbed } from "@/components/ui/SsoEmbed";
import { MessageSquare } from "lucide-react";

export default function ChatPage() {
  const chatUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || "";

  return (
    <AppShell>
      {chatUrl ? (
        <SsoEmbed
          baseUrl={chatUrl}
          // Mattermost Team Edition không có Generic OIDC nên SSO qua cổng
          // GitLab OAuth trỏ về Keycloak (xem deploy/setup.sh §7.5).
          ssoUrl={`${chatUrl.replace(/\/+$/, "")}/oauth/gitlab/login`}
          title="Mattermost Chat"
          storageKey="proteus-sso-mattermost"
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-text-secondary">
          <MessageSquare className="w-16 h-16 opacity-30" />
          <p className="mt-4 text-text-secondary">
            Tích hợp Chat chưa được cấu hình. Vui lòng liên hệ Admin để thiết lập.
          </p>
        </div>
      )}
    </AppShell>
  );
}
