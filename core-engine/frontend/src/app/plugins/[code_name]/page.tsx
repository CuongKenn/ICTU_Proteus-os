// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppShell } from "@/components/AppShell";
import { Blocks } from "lucide-react";
import Link from "next/link";

interface PluginPageProps {
  params: {
    code_name: string;
  };
}

export default function PluginPage({ params }: PluginPageProps) {
  const { code_name } = params;

  return (
    <AppShell>
        <h1 className="text-2xl font-bold text-text-primary px-4 py-2">
          {code_name}
        </h1>
        <div className="flex-1 w-full bg-bg-surface overflow-hidden relative">
          {process.env.NEXT_PUBLIC_APPSMITH_URL ? (
            <iframe 
              src={`${process.env.NEXT_PUBLIC_APPSMITH_URL}/app/${code_name}`}
              className="w-full h-full border-0 absolute inset-0"
              title={`Appsmith - ${code_name}`}
              allow="camera; microphone; fullscreen; display-capture; geolocation"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-text-secondary p-8 text-center animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-bg-surface/50 border border-border flex items-center justify-center mb-2">
                <Blocks className="w-10 h-10 text-brand-primary/50" />
              </div>
              <h2 className="text-xl font-bold text-text-primary">
                Appsmith URL Chưa Được Cấu Hình
              </h2>
              <p className="max-w-md">
                Biến môi trường NEXT_PUBLIC_APPSMITH_URL chưa được thiết lập.
              </p>
            </div>
          )}
        </div>
    </AppShell>
  );
}
