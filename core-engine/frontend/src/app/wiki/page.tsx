// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { SsoEmbed } from "@/components/ui/SsoEmbed";
import { BookOpen } from "lucide-react";

export default function WikiPage() {
  // Runtime env, fallback "" an toàn (không hardcode proteus.local).
  const wikiUrl = process.env.NEXT_PUBLIC_OUTLINE_URL || "";

  return (
    <AppShell>
      {wikiUrl ? (
        <SsoEmbed
          baseUrl={wikiUrl}
          title="Outline Wiki"
          storageKey="proteus:sso:wiki:done"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-brand-primary/25 bg-gradient-to-br from-brand-primary/15 via-bg-surface to-brand-secondary/10">
            <BookOpen className="h-10 w-10 text-brand-primary" />
          </span>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-text-primary">Tài liệu nội bộ</h1>
          <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
            Tích hợp Wiki chưa được cấu hình. Vui lòng liên hệ Admin để thiết lập.
          </p>
        </div>
      )}
    </AppShell>
  );
}
