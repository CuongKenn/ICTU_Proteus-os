// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Metadata } from "next";
import { MarketplaceClient } from "./MarketplaceClient";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Marketplace | Proteus OS",
  description: "Khám phá và cài đặt các plugin cho Proteus OS.",
};

export default function MarketplacePage() {
  return (
    <AppShell>
      <main className="h-full bg-bg-base overflow-y-auto">
        <MarketplaceClient />
      </main>
    </AppShell>
  );
}
