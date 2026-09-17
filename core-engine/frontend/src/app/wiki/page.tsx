// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { IframeEmbed } from "@/components/ui/IframeEmbed";
import { BookOpen } from "lucide-react";

export default function WikiPage() {
  const wikiUrl = process.env.NEXT_PUBLIC_OUTLINE_URL || "http://wiki.proteus.local";

  return (
    <AppShell>
      {wikiUrl ? (
        <IframeEmbed
          src={wikiUrl}
          title="Outline Wiki"
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
