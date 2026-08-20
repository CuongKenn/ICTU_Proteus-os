// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState, useMemo } from "react";
import { useSession } from "@/hooks/useSession";
import { PluginCard, type PluginData, type PluginStatus } from "@/components/marketplace/PluginCard";
import { CategoryFilter } from "@/components/marketplace/CategoryFilter";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { Modal } from "@/components/ui/Modal";
import { InstallPreviewDialog } from "./InstallPreviewDialog";
import { useMarketplace } from "@/hooks/useMarketplace";
import { usePlugins } from "@/hooks/usePlugins";
import { PackageOpen, Sparkles } from "lucide-react";

const CATEGORIES = ["HR", "CRM", "Finance", "Utilities", "Analytics", "Communication"];

export const MarketplaceClient: React.FC = () => {
  const { hasRole } = useSession();
  const isAdmin = hasRole("tenant_admin");

  const { installingId, installProgress, installStatus, installPlugin, uninstallPlugin } = useMarketplace();
  const { plugins: allPlugins, isLoading, refetch: refetchInstalled, configureCredentials } = usePlugins();

  const [previewPlugin, setPreviewPlugin] = useState<PluginData | null>(null);
  const [isInstallPreviewOpen, setIsInstallPreviewOpen] = useState(false);

  const [uninstallPluginData, setUninstallPluginData] = useState<{ id: string; name: string } | null>(null);
  const [isUninstallConfirmOpen, setIsUninstallConfirmOpen] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Combine both lists
  const mergedPluginsList = useMemo(() => {
    const list: Array<{ data: PluginData; status: PluginStatus; isInstalled: boolean }> = [];
    
    allPlugins.forEach(p => {
      const isInstalled = p.status !== null && p.status !== undefined;
      let uiStatus: PluginStatus = "available";
      
      if (isInstalled) {
        uiStatus = "active";
        if (p.status === "FAILED_DIRTY") uiStatus = "failed";
        else if (p.status === "DISABLED") uiStatus = "disabled";
        else if (p.status === "INSTALLING") uiStatus = "installing";
      }

      // Mock category if undefined
      let cat = (p as any).category;
      if (!cat) {
        if (p.code_name?.includes("hr")) cat = "HR";
        else if (p.code_name?.includes("crm")) cat = "CRM";
        else if (p.code_name?.includes("finance")) cat = "Finance";
        else cat = "Utilities";
      }

      list.push({
        data: {
          id: p.id,
          codeName: p.code_name,
          name: p.display_name,
          version: p.version,
          description: (p as any).description || "Không có mô tả cho ứng dụng này.",
          tablesCount: p.tables_count ?? 5, // mock fallback until PR 444 is merged
          workflowsCount: p.workflows_count ?? 2,
          requiredRoles: p.roles ?? ["tenant_admin"],
          isOfficial: p.is_official,
          category: cat,
        },
        status: uiStatus,
        isInstalled,
      });
    });

    return list;
  }, [allPlugins]);

  // Filter plugins based on search and category
  const filteredPlugins = useMemo(() => {
    return mergedPluginsList.filter(p => {
      const matchCategory = selectedCategory === "All" || p.data.category === selectedCategory;
      const matchSearch = p.data.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.data.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [mergedPluginsList, searchQuery, selectedCategory]);

  // Handlers
  const handleInstallClick = (id: string) => {
    if (!isAdmin) return;
    const plugin = mergedPluginsList.find(p => p.data.id === id)?.data;
    if (plugin) {
      setPreviewPlugin(plugin);
      setIsInstallPreviewOpen(true);
    }
  };

  const handleConfirmInstall = async (credentials?: { credential_type: string, credential_name: string, data: Record<string, string> }) => {
    if (previewPlugin && isAdmin) {
      if (credentials) {
        try {
          await configureCredentials(previewPlugin.id, credentials);
        } catch (e) {
          // If credentials configuration fails, do not proceed with installation
          return;
        }
      }
      setIsInstallPreviewOpen(false);
      await installPlugin(previewPlugin.codeName || "");
    }
  };

  const handleUninstallClick = (id: string) => {
    if (!isAdmin) return;
    const plugin = allPlugins.find(p => p.data.id === id)?.data;
    if (plugin) {
      setUninstallPluginData({ id: plugin.id, name: plugin.name });
      setIsUninstallConfirmOpen(true);
    }
  };

  const handleConfirmUninstall = async () => {
    if (uninstallPluginData && isAdmin) {
      setIsUninstalling(true);
      await uninstallPlugin(uninstallPluginData.id);
      setIsUninstalling(false);
      setIsUninstallConfirmOpen(false);
      setUninstallPluginData(null);
      // Refresh list after uninstall
      setTimeout(() => refetchInstalled(), 1000);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 min-h-[500px]">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-20 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 mt-8">
      {/* Hero Section */}
      <div className="flex flex-col gap-6 relative p-8 md:p-12 rounded-3xl overflow-hidden glass-card border border-border/40 bg-gradient-to-br from-brand-primary/10 via-transparent to-transparent">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-brand-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-brand-secondary/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col gap-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-sm font-semibold w-fit">
            <Sparkles className="w-4 h-4" /> App Store
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-text-primary tracking-tight">
            Khám phá Ứng dụng
          </h1>
          <p className="text-lg text-text-secondary">
            Mở rộng khả năng của hệ thống với hàng chục ứng dụng được thiết kế tối ưu cho doanh nghiệp của bạn.
          </p>
        </div>

        <div className="relative z-10 mt-4 w-full">
          <CategoryFilter 
            categories={CATEGORIES}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="flex flex-col gap-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredPlugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 glass-card border border-border/50 border-dashed rounded-3xl text-center">
            <div className="w-24 h-24 bg-bg-surface-elevated rounded-full flex items-center justify-center mb-6 shadow-inner border border-border/50">
              <PackageOpen className="w-12 h-12 text-text-muted opacity-50" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Không tìm thấy ứng dụng nào</h3>
            <p className="text-text-secondary max-w-md">
              {searchQuery 
                ? `Không có kết quả nào khớp với "${searchQuery}". Hãy thử tìm kiếm với từ khóa khác.`
                : "Marketplace hiện chưa có ứng dụng nào trong danh mục này."}
            </p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="mt-6 text-brand-primary font-medium hover:underline"
              >
                Xóa tìm kiếm
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-fr">
            {filteredPlugins.map(({ data, status }) => {
              // Override status if this plugin is currently installing
              const currentStatus = installingId === data.id ? (installStatus || status) : status;
              
              return (
                <PluginCard
                  key={data.id}
                  plugin={data}
                  status={currentStatus as PluginStatus}
                  installProgress={installingId === data.id ? installProgress : 0}
                  onInstall={isAdmin ? handleInstallClick : undefined}
                  onUninstall={isAdmin ? handleUninstallClick : undefined}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Install Preview Dialog */}
      <InstallPreviewDialog
        isOpen={isInstallPreviewOpen}
        plugin={previewPlugin}
        onClose={() => setIsInstallPreviewOpen(false)}
        onConfirm={handleConfirmInstall}
      />

      {/* Uninstall Confirm Modal */}
      <Modal
        isOpen={isUninstallConfirmOpen}
        title="Gỡ cài đặt Plugin"
        onClose={() => {
          setIsUninstallConfirmOpen(false);
          setUninstallPluginData(null);
        }}
        confirmKeyword={uninstallPluginData?.name}
        onConfirm={handleConfirmUninstall}
        confirmLabel="Gỡ cài đặt"
        confirmVariant="danger"
        isConfirmLoading={isUninstalling}
      >
        <div className="flex flex-col gap-4">
          <p>
            Bạn có chắc chắn muốn gỡ cài đặt ứng dụng <strong>{uninstallPluginData?.name}</strong>?
          </p>
          <div className="text-sm text-danger bg-danger/10 p-4 rounded-xl border border-danger/20 font-medium">
            ⚠️ <strong>Cảnh báo nguy hiểm:</strong> Hành động này không thể hoàn tác. 
            Toàn bộ dữ liệu nghiệp vụ, bảng (tables), và workflows liên quan đến ứng dụng này sẽ bị xóa vĩnh viễn khỏi hệ thống.
          </div>
        </div>
      </Modal>
    </div>
  );
};
