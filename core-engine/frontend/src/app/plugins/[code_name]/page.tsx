// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
interface PluginPageProps {
  params: {
    code_name: string;
  };
}

export default function PluginPage({ params }: PluginPageProps) {
  const { code_name } = params;
  const appsmithUrl = process.env.NEXT_PUBLIC_APPSMITH_URL || "http://localhost:8080";
  const iframeUrl = `${appsmithUrl}/app/${code_name}`;

  return (
    <AppShell>
      <div className="w-full h-[calc(100vh-56px)]">
        <iframe
          src={iframeUrl}
          className="w-full h-full border-0"
          title={`Plugin ${code_name}`}
        />
      </div>
    </AppShell>
  );
}
