// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { SettingsClient } from "./SettingsClient";

export const metadata: Metadata = {
  title: "Cài đặt — Proteus OS",
};

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsClient />
    </AppShell>
  );
}
