// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { MarketplaceClient } from "./MarketplaceClient";

export const metadata: Metadata = {
  title: "Marketplace | Proteus OS",
  description: "Khám phá và cài đặt các plugin cho Proteus OS.",
};

export default function MarketplacePage() {
  return (
    <AppShell>
      <div className="overflow-y-auto">
        <MarketplaceClient />
      </div>
    </AppShell>
  );
}
