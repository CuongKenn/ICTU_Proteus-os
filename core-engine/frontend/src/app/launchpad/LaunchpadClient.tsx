// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState, useEffect } from "react";
import { usePlugins } from "@/hooks/usePlugins";
import { AppIcon } from "@/components/ui/AppIcon";
import { useSession } from "next-auth/react";

const MATTERMOST_URL = process.env.NEXT_PUBLIC_MATTERMOST_URL || "http://chat.proteus.local";
const OUTLINE_URL = process.env.NEXT_PUBLIC_OUTLINE_URL || "http://wiki.proteus.local";
const N8N_URL = process.env.NEXT_PUBLIC_N8N_URL || "http://workflow.proteus.local";
import { useNotificationStore } from "@/store/notificationStore";
import { Blocks, Box, FileText, MessageSquare, Network, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useLang } from "@/components/i18n/LanguageContext";

export function LaunchpadClient() {
  const { data: session } = useSession();
  const hasRole = useAuthStore((state) => state.hasRole);
  const isAdmin = hasRole("tenant_admin") || hasRole("superadmin");
  const { plugins, isLoading } = usePlugins();
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const addToast = useNotificationStore((state) => state.addToast);
  const router = useRouter();
  const { t } = useLang();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeApp) closeIframe();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [activeApp]);

  const openIframe = (appId: string, url: string) => {
    setActiveApp(appId);
    setIframeUrl(url);
    setIsIframeLoading(true);
  };

  const handleOpenMetabase = async () => {
    setIsIframeLoading(true);
    setActiveApp("metabase");
    try {
      const res = await fetch("/api/embed/metabase?dashboard_id=1");
      if (!res.ok) throw new Error("Failed to fetch signed URL");
      const data = await res.json();
      setIframeUrl(data.url);
    } catch (err) {
      addToast("error", "Không thể tải báo cáo Metabase");
      setActiveApp(null);
    }
  };

  const closeIframe = () => { setActiveApp(null); setIframeUrl(null); };

  const handleOpenPlugin = (code_name: string) => {
    const appsmithUrl = `${process.env.NEXT_PUBLIC_APPSMITH_URL || "http://apps.proteus.local"}/app/${code_name}`;
    openIframe(code_name, appsmithUrl);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("launchpad.morning");
    if (hour < 18) return t("launchpad.afternoon");
    return t("launchpad.evening");
  };

  return (
    <div className="relative">
      <div className="p-6 md:p-10 max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="mb-10 animate-slide-up">
          <div className="mono-tag mb-4">
            <span className="pulse-dot" />
            WORKSPACE ACTIVE
          </div>
          <h1 className="text-3xl font-grot font-bold tracking-tight mb-2" style={{ color: "var(--ink)" }}>
            Chào buổi {getGreeting()}, <span style={{ color: "var(--accent)" }}>{session?.user?.name || 'bạn'}</span>!
          </h1>
          <p className="font-mono text-meta" style={{ color: "var(--dim)" }}>
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* System Apps */}
        <section className="mb-12 animate-fade-in">
          <h2 className="font-mono text-meta font-medium mb-6 flex items-center gap-3" style={{ color: "var(--dim)" }}>
            <span>{t("launchpad.system")}</span>
            <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
          </h2>
          <div className="flex flex-wrap gap-6 sm:gap-8">
            <AppIcon appName="Mattermost" icon={<MessageSquare className="w-7 h-7" style={{ color: "var(--accent)" }} />} onClick={() => router.push("/chat")} isActive />
            <AppIcon appName="Outline Wiki" icon={<FileText className="w-7 h-7" style={{ color: "var(--muted)" }} />} onClick={() => router.push("/wiki")} isActive />
            {isAdmin && <AppIcon appName="n8n Workflow" icon={<Network className="w-7 h-7" style={{ color: "var(--amber)" }} />} onClick={() => openIframe("n8n", N8N_URL)} isActive />}
            {isAdmin && <AppIcon appName="Metabase" icon={<Box className="w-7 h-7" style={{ color: "var(--accent)" }} />} onClick={handleOpenMetabase} isActive />}
          </div>
        </section>

        {/* Plugin Apps */}
        <section className="animate-fade-in">
          <h2 className="font-mono text-meta font-medium mb-6 flex items-center gap-3" style={{ color: "var(--dim)" }}>
            <span>{t("launchpad.plugins")}</span>
            <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
          </h2>
          <div className="flex flex-wrap gap-6 sm:gap-8">
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 w-24 animate-pulse">
                <div className="w-[72px] h-[72px] rounded-2xl" style={{ background: "var(--line)" }} />
                <div className="h-3 rounded-lg w-16 mt-1" style={{ background: "var(--line)" }} />
              </div>
            ))}
            {!isLoading && plugins.filter((p) => {
              if (isAdmin) return true;
              if (!p.roles || p.roles.length === 0) return true;
              return p.roles.some((r) => hasRole(r));
            }).map((plugin) => (
              <AppIcon
                key={plugin.id}
                appName={plugin.display_name}
                icon={<Blocks className="w-7 h-7" style={{ color: "var(--accent)" }} />}
                onClick={() => handleOpenPlugin(plugin.code_name)}
                isActive={plugin.status === "ACTIVE"}
              />
            ))}
          </div>
        </section>

        {/* Empty State */}
        {!isLoading && plugins.length === 0 && (
          <div className="mt-16 text-center animate-fade-in">
            <div className="card inline-flex items-center justify-center w-20 h-20 mb-6">
              <Blocks className="w-10 h-10" style={{ color: "var(--ghost)" }} />
            </div>
            <h3 className="text-xl font-grot font-bold mb-3" style={{ color: "var(--ink)" }}>{t("launchpad.no_plugins")}</h3>
            <p className="max-w-sm mx-auto leading-relaxed mb-6" style={{ color: "var(--muted)" }}>
              Không gian làm việc của bạn chưa được cài đặt bất kỳ công cụ nào.
            </p>
            <button onClick={() => router.push('/marketplace')} className="btn-accent">{t("launchpad.explore")}</button>
          </div>
        )}
      </div>

      {/* Iframe Overlay */}
      {activeApp && iframeUrl && (
        <div className="fixed inset-0 z-[100] flex flex-col animate-fade-in" style={{ background: "var(--paper)" }}>
          <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: "1px solid var(--line)", background: "var(--paper-raised)" }}>
            <h2 className="font-mono text-meta font-medium" style={{ color: "var(--ink)" }}>
              {activeApp === "metabase" ? "Metabase Analytics" : activeApp === "n8n" ? "n8n Workflow" : plugins.find(p => p.code_name === activeApp)?.display_name || activeApp}
            </h2>
            <button onClick={closeIframe} className="p-2 rounded-lg transition-colors" style={{ color: "var(--dim)" }} title="Đóng (Esc)">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 relative">
            {isIframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: "var(--paper)" }}>
                <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: "var(--line)", borderTopColor: "var(--accent)" }} />
              </div>
            )}
            <iframe src={iframeUrl} className="w-full h-full border-none" onLoad={() => setIsIframeLoading(false)} allow="clipboard-read; clipboard-write; fullscreen" />
          </div>
        </div>
      )}
    </div>
  );
}
