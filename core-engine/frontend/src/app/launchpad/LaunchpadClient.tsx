"use client";

import React, { useState } from "react";
import { usePlugins } from "@/hooks/usePlugins";
import { AppIcon } from "@/components/ui/AppIcon";
import { useNotificationStore } from "@/store/notificationStore";
import { Blocks, Box, FileText, MessageSquare, Network, X } from "lucide-react";

export function LaunchpadClient() {
  const { plugins, isLoading } = usePlugins();
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const addToast = useNotificationStore((state) => state.addToast);

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
    addToast("info", "Tính năng đang phát triển");
  };

  return (
    <div className="p-10 max-w-7xl mx-auto min-h-screen">
      <h1 className="text-3xl font-bold text-text-primary mb-10 animate-fade-in">Launchpad</h1>
      
      {/* Grid Container */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-8 justify-items-center">
        
        {/* System Apps */}
        <AppIcon
          appName="Mattermost"
          icon={<MessageSquare className="w-8 h-8 text-blue-500" />}
          onClick={() => openInNewTab("http://localhost:8065")}
        />
        <AppIcon
          appName="Outline Wiki"
          icon={<FileText className="w-8 h-8 text-text-secondary" />}
          onClick={() => openInNewTab("http://localhost:3000")} // Assuming Outline URL port
        />
        <AppIcon
          appName="n8n Workflow"
          icon={<Network className="w-8 h-8 text-orange-500" />}
          onClick={() => openIframe("n8n", "http://localhost:5678")}
        />
        <AppIcon
          appName="Metabase"
          icon={<Box className="w-8 h-8 text-brand-primary" />}
          onClick={handleOpenMetabase}
        />

        {/* Plugin Skeletons */}
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 w-24 animate-pulse-slow">
              <div className="w-20 h-20 rounded-[20px] bg-bg-surface/50 border border-border/50 shrink-0" />
              <div className="h-3 bg-bg-surface/40 rounded w-16 mt-1" />
            </div>
          ))}

        {/* Plugins */}
        {!isLoading && plugins.map((plugin) => (
          <AppIcon
            key={plugin.id}
            appName={plugin.display_name}
            icon={<Blocks className="w-8 h-8 text-text-secondary/80" />}
            onClick={() => handleOpenPlugin(plugin.code_name)}
          />
        ))}
      </div>

      {/* Empty State for Plugins */}
      {!isLoading && plugins.length === 0 && (
        <div className="mt-20 text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-bg-surface/50 border border-border/50 text-text-secondary/40 mb-6">
            <Blocks className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-semibold text-text-primary mb-2">Chưa có Plugin</h3>
          <p className="text-text-secondary max-w-sm mx-auto leading-relaxed">
            Hệ thống chưa được cài đặt bất kỳ Plugin nào. Vui lòng truy cập Marketplace để khám phá và cài đặt.
          </p>
        </div>
      )}

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
