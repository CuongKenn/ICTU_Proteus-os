// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { IframeEmbed } from "@/components/ui/IframeEmbed";
import { FolderOpen } from "lucide-react";

export default function FilesPage() {
  const filesUrl = process.env.NEXT_PUBLIC_FILES_URL;

  return (
    <AppShell>
      {filesUrl ? (
        <IframeEmbed
          src={filesUrl}
          title="File Manager"
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-text-secondary">
          <FolderOpen className="w-16 h-16 opacity-30" />
          <h1 className="text-2xl font-bold text-text-primary">File Manager</h1>
          <p>The File Manager integration is currently disabled or not configured properly.</p>
        </div>
      )}
    </AppShell>
  );
}
