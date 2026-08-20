// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState, useEffect } from "react";
import { usePlugins } from "@/hooks/usePlugins";
import { AppIcon } from "@/components/ui/AppIcon";
import { useSession } from "next-auth/react";

const MATTERMOST_URL = process.env.NEXT_PUBLIC_MATTERMOST_URL || "http://localhost:8065";
const OUTLINE_URL = process.env.NEXT_PUBLIC_OUTLINE_URL || "http://localhost:3000";
const N8N_URL = process.env.NEXT_PUBLIC_N8N_URL || "http://localhost:5678";
import { useNotificationStore } from "@/store/notificationStore";
import { Blocks, Box, FileText, MessageSquare, Network, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function LaunchpadClient() {
  const { data: session } = useSession();
  const { plugins, isLoading } = usePlugins();
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const addToast = useNotificationStore((state) => state.addToast);
  const router = useRouter();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeApp) closeIframe();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [activeApp]);

  const openInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

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

  const closeIframe = () => {
    setActiveApp(null);
    setIframeUrl(null);
  };

  const handleOpenPlugin = (code_name: string) => {
    router.push(`/plugins/${code_name}`);
  };

  return (
    <div className="relative min-h-screen">
      {/* Dynamic Background Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-primary/10 via-bg-base to-bg-base -z-10 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-brand-primary/5 to-transparent -z-10 pointer-events-none" />

      <div className="p-10 max-w-7xl mx-auto relative z-0">
        <div className="mb-10 animate-fade-in">
          <h1 className="text-3xl font-bold text-text-primary tracking-tight mb-2">
            Chào buổi {new Date().getHours() < 12 ? 'sáng' : new Date().getHours() < 18 ? 'chiều' : 'tối'}, {session?.user?.name || 'bạn'}!
          </h1>
          <p className="text-text-secondary">
            Hôm nay là {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      
      {/* System Apps Section */}
      <section className="mb-12 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-6 flex items-center gap-2">
          Hệ thống
          <div className="flex-1 h-px bg-border/50" />
        </h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-6 sm:gap-8 justify-items-center">
          <AppIcon
            appName="Mattermost"
            icon={<MessageSquare className="w-8 h-8 text-blue-500" />}
            onClick={() => router.push("/chat")}
            isActive
          />
          <AppIcon
            appName="Outline Wiki"
            icon={<FileText className="w-8 h-8 text-text-secondary" />}
            onClick={() => router.push("/wiki")}
            isActive
          />
          <AppIcon
            appName="n8n Workflow"
            icon={<Network className="w-8 h-8 text-orange-500" />}
            onClick={() => openIframe("n8n", N8N_URL)}
            isActive
          />
          <AppIcon
            appName="Metabase"
            icon={<Box className="w-8 h-8 text-brand-primary" />}
            onClick={handleOpenMetabase}
            isActive
          />
        </div>
      </section>

      {/* Plugin Apps Section */}
      <section className="animate-fade-in" style={{ animationDelay: '200ms' }}>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-6 flex items-center gap-2">
          Ứng dụng cài đặt
          <div className="flex-1 h-px bg-border/50" />
        </h2>
        
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-6 sm:gap-8 justify-items-center">
          {/* Plugin Skeletons */}
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 w-24 animate-pulse-slow">
                <div className="w-20 h-20 rounded-[20px] bg-bg-surface/50 border border-border/50 shrink-0" />
                <div className="h-3 bg-bg-surface/40 rounded w-16 mt-1" />
              </div>
            ))}

          {/* Plugins */}
          {!isLoading && plugins.map((plugin) => {
            // Generate a color based on the plugin's code_name
            const colors = ['text-blue-400', 'text-green-400', 'text-purple-400', 'text-pink-400', 'text-yellow-400', 'text-indigo-400'];
            const colorClass = colors[plugin.code_name.length % colors.length];
            
            return (
              <AppIcon
                key={plugin.id}
                appName={plugin.display_name}
                icon={<Blocks className={`w-8 h-8 ${colorClass}`} />}
                onClick={() => handleOpenPlugin(plugin.code_name)}
                isActive={plugin.status === "ACTIVE"}
              />
            );
          })}
        </div>
      </section>

      {/* Empty State for Plugins */}
      {!isLoading && plugins.length === 0 && (
        <div className="mt-20 text-center animate-fade-in">
          <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-bg-surface/50 border border-border/50 text-text-secondary/40 mb-6 group hover:border-brand-primary/50 transition-colors">
            <div className="absolute inset-0 rounded-full bg-brand-primary/5 blur-xl group-hover:bg-brand-primary/10 transition-colors" />
            <Blocks className="w-12 h-12 relative z-10 text-brand-primary/60 group-hover:text-brand-primary transition-colors" />
          </div>
          <h3 className="text-2xl font-bold text-text-primary mb-3">Chưa có Plugin nào</h3>
          <p className="text-text-secondary max-w-sm mx-auto leading-relaxed mb-6">
            Không gian làm việc của bạn chưa được cài đặt bất kỳ công cụ nào. Hãy truy cập Marketplace để khám phá thêm.
          </p>
          <button 
            onClick={() => router.push('/marketplace')}
            className="px-6 py-2.5 rounded-lg bg-brand-primary/10 text-brand-primary font-semibold hover:bg-brand-primary/20 transition-all border border-brand-primary/20 hover:scale-105 active:scale-95"
          >
            Khám phá Marketplace
          </button>
        </div>
      )}
      </div>

      {/* Iframe Overlay */}
      {activeApp && iframeUrl && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-bg-base/95 backdrop-blur-2xl animate-fade-in">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-bg-surface/40 shadow-sm">
            <h2 className="text-lg font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
              {activeApp === "metabase" ? (
                <><Box className="w-5 h-5 text-brand-primary" /> Metabase Analytics</>
              ) : (
                <><Network className="w-5 h-5 text-orange-500" /> n8n Workflow</>
              )}
            </h2>
            <button
              onClick={closeIframe}
              className="p-2 rounded-full hover:bg-bg-surface/80 text-text-secondary hover:text-text-primary transition-all duration-200"
              title="Đóng (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Iframe Content */}
          <div className="flex-1 relative bg-bg-base">
            {isIframeLoading && activeApp !== "metabase" && (
               <div className="absolute inset-0 flex items-center justify-center bg-bg-base z-10 animate-pulse-slow">
                 <div className="flex flex-col items-center gap-4">
                   <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
                   <div className="text-text-secondary font-medium tracking-wide">Đang tải ứng dụng...</div>
                 </div>
               </div>
            )}
            <iframe
              src={iframeUrl}
              className="w-full h-full border-none"
              onLoad={() => setIsIframeLoading(false)}
              allow="clipboard-read; clipboard-write; fullscreen"
            />
          </div>
        </div>
      )}
    </div>
  );
}
