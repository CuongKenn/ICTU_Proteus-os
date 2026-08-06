// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Launchpad Page — App Shell chính của Proteus OS
// Hiển thị Plugin Apps dưới dạng Icon Grid.
// Các app ngoài (Appsmith, Metabase) nhúng qua Iframe trong nội dung.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Launchpad — Proteus OS",
};

export default function LaunchpadPage() {
  return (
    <main className="min-h-screen bg-bg-primary">
      {/* TODO: Member implement Launchpad UI ở đây */}
      {/* Tham chiếu thiết kế: docs/ui_ux_design.md §4 */}
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="text-6xl">🚀</div>
          <h1 className="text-3xl font-bold text-text-primary">
            Proteus OS Launchpad
          </h1>
          <p className="text-text-secondary">
            Foundation đã sẵn sàng. Member bắt đầu implement từ đây!
          </p>
          <div className="text-xs text-text-secondary/50 font-mono">
            core-engine/frontend/src/app/launchpad/page.tsx
          </div>
        </div>
      </div>
    </main>
  );
}
