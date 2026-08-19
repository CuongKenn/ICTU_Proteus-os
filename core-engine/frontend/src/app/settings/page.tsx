// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { SettingsClient } from "./SettingsClient";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="p-4 md:p-8">
        <SettingsClient />
      </div>
    </AppShell>
  );
}
