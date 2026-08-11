// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";

export default function WikiPage() {
  return (
    <AppShell>
      <iframe
        src={process.env.NEXT_PUBLIC_OUTLINE_URL || "http://localhost:3000"}
        className="w-full h-full border-0"
        title="Outline Wiki"
      />
    </AppShell>
  );
}
