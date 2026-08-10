// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Launchpad Page — App Shell chính của Proteus OS
// Hiển thị Plugin Apps dưới dạng Icon Grid.
// Các app ngoài (Appsmith, Metabase) nhúng qua Iframe trong nội dung.

import type { Metadata } from "next";
import { LaunchpadClient } from "./LaunchpadClient";

export const metadata: Metadata = {
  title: "Launchpad — Proteus OS",
};

export default function LaunchpadPage() {
  return (
    <main className="min-h-screen bg-bg-base">
      <LaunchpadClient />
    </main>
  );
}
