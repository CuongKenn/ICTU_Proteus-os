// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";

export default function FilesPage() {
  return (
    <AppShell>
      <iframe
        src={process.env.NEXT_PUBLIC_APPSMITH_URL || "http://localhost:8080"}
        className="w-full h-full border-0"
        title="Appsmith Files"
      />
    </AppShell>
  );
}
