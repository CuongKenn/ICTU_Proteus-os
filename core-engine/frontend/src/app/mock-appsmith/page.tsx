"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LayoutDashboard, Users, Settings, Activity, FileText } from "lucide-react";

function MockAppsmithContent() {
  const searchParams = useSearchParams();
  const plugin = searchParams.get("plugin") || "Plugin";

  return (
    <div className="min-h-screen bg-bg-base text-text-primary p-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/50">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-brand-secondary">
            {plugin.toUpperCase()} - Workspace
          </h1>
          <p className="text-sm text-text-secondary mt-1">Appsmith Low-code UI Demo</p>
        </div>
        <div className="flex gap-4">
          <button className="px-4 py-2 bg-bg-surface border border-border/50 rounded-md hover:bg-bg-surface/80 transition-colors">
            Share
          </button>
          <button className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors font-medium">
            Deploy
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="col-span-2 space-y-2">
          {[
            { icon: LayoutDashboard, label: "Dashboard" },
            { icon: Users, label: "Customers" },
            { icon: FileText, label: "Tickets" },
            { icon: Activity, label: "Analytics" },
            { icon: Settings, label: "Settings" },
          ].map((item, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${i === 0 ? 'bg-brand-primary/10 text-brand-primary' : 'hover:bg-bg-surface text-text-secondary hover:text-text-primary'}`}>
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Workspace Widget Area */}
        <div className="col-span-10">
          <div className="bg-bg-surface border border-border/50 rounded-xl p-8 min-h-[600px] flex flex-col items-center justify-center text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent pointer-events-none" />
            
            <div className="w-20 h-20 bg-bg-base rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-border/30 relative z-10">
              <LayoutDashboard className="w-10 h-10 text-brand-primary" />
            </div>
            
            <h2 className="text-xl font-bold mb-2 relative z-10">Giao diện giả lập (Mock UI)</h2>
            <p className="text-text-secondary max-w-md mx-auto mb-8 relative z-10">
              Đây là trang giả lập giao diện Appsmith cho plugin <strong>{plugin}</strong>. Trong thực tế, bạn sẽ dùng trình thiết kế kéo thả của Appsmith để tạo các Widget (Table, Form, Chart) tại đây.
            </p>

            <div className="grid grid-cols-3 gap-4 w-full max-w-3xl relative z-10">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-bg-base border border-border/50 rounded-lg p-4 text-left shadow-sm">
                  <div className="h-4 w-1/2 bg-bg-surface rounded mb-4 animate-pulse" />
                  <div className="h-3 w-full bg-bg-surface rounded mb-2 animate-pulse" />
                  <div className="h-3 w-3/4 bg-bg-surface rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MockAppsmithPage() {
  return (
    <Suspense fallback={<div className="p-10 text-text-secondary">Loading mock UI...</div>}>
      <MockAppsmithContent />
    </Suspense>
  );
}
