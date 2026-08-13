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
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-secondary p-8 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-bg-surface/50 border border-border flex items-center justify-center mb-2">
          <Blocks className="w-10 h-10 text-brand-primary/50" />
        </div>
        <h1 className="text-3xl font-bold text-text-primary">
          Plugin: <span className="text-brand-primary">{code_name}</span>
        </h1>
        <p className="max-w-md">
          Tính năng UI cho Plugin này đang được phát triển hoặc Plugin này chỉ cung cấp backend services.
        </p>
        <Link 
          href="/launchpad"
          className="mt-6 px-6 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
        >
          Quay lại Launchpad
        </Link>
      </div>
    </AppShell>
  );
}
