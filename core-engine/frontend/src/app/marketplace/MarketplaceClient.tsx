// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState, useMemo } from "react";
import { useSession } from "@/hooks/useSession";
import { useRBAC } from "@/hooks/useRBAC";
import { PluginCard, type PluginData, type PluginStatus } from "@/components/marketplace/PluginCard";
import { CategoryFilter } from "@/components/marketplace/CategoryFilter";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { Modal } from "@/components/ui/Modal";
import { InstallPreviewDialog } from "./InstallPreviewDialog";
import { useMarketplace } from "@/hooks/useMarketplace";
import { usePlugins } from "@/hooks/usePlugins";
import { PackageOpen, Sparkles } from "lucide-react";
import type { CredentialFieldSchema, CredentialInput } from "@/types";

const CATEGORIES = ["HR", "CRM", "Finance", "Utilities", "Analytics", "Communication"];

export const MarketplaceClient: React.FC = () => {
  useSession();
  const { hasPermission, isLoading: isRBACLoading } = useRBAC();
  const canInstall = hasPermission("plugins:install");

  const { plugins: availablePlugins, isLoading: isLoadingAvailable, installingId, installProgress, installStatus, installPlugin, uninstallPlugin } = useMarketplace();
  const { plugins: installedPlugins, isLoading: isLoadingInstalled, refetch: refetchInstalled } = usePlugins();

  const [previewPlugin, setPreviewPlugin] = useState<PluginData | null>(null);
  const [previewCredSchema, setPreviewCredSchema] = useState<CredentialFieldSchema[]>([]);
  const [isInstallPreviewOpen, setIsInstallPreviewOpen] = useState(false);

  const [uninstallPluginData, setUninstallPluginData] = useState<{ id: string; name: string } | null>(null);
  const [isUninstallConfirmOpen, setIsUninstallConfirmOpen] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const allPlugins = useMemo(() => {
    const list: Array<{ data: PluginData; credSchema: CredentialFieldSchema[]; status: PluginStatus; isInstalled: boolean }> = [];

    // Add installed plugins
    installedPlugins.forEach(p => {
      let uiStatus: PluginStatus = "active";
      if (p.status === "FAILED_DIRTY") uiStatus = "failed";
      else if (p.status === "DISABLED") uiStatus = "disabled";
      else if (p.status === "INSTALLING") uiStatus = "installing";
      else if (p.status === "PENDING_CREDENTIALS") uiStatus = "failed"; // show as warning

      list.push({
        data: {
          id: p.id,
          codeName: p.code_name,
          name: p.display_name,
          version: p.version,
          description: p.description || "Không có mô tả cho ứng dụng này.",
          tablesCount: p.tables_count ?? 0,
          workflowsCount: p.workflows_count ?? 0,
          requiredRoles: p.roles ?? [],
          isOfficial: p.is_official,
          category: p.category || "Utilities",
          author: p.author ?? undefined,
          tags: p.tags ?? [],
        },
        credSchema: p.credentials_schema ?? [],
        status: uiStatus,
        isInstalled: true,
      });
    });

    // Add available plugins (not already installed)
    availablePlugins.forEach(p => {
      if (!installedPlugins.find(ip => ip.code_name === p.code_name)) {
        list.push({
          data: {
            id: p.id,
            codeName: p.code_name,
            name: p.display_name,
            version: p.version,
            description: p.description || "Không có mô tả cho ứng dụng này.",
            tablesCount: p.tables_count ?? 0,
            workflowsCount: p.workflows_count ?? 0,
            requiredRoles: p.roles ?? [],
            isOfficial: p.is_official,
            category: p.category || "Utilities",
            author: p.author ?? undefined,
            tags: p.tags ?? [],
          },
          credSchema: p.credentials_schema ?? [],
          status: "available",
          isInstalled: false,
        });
      }
    });

    return list;
  }, [availablePlugins, installedPlugins]);

  // Filter plugins based on search and category
  const filteredPlugins = useMemo(() => {
    return allPlugins.filter(p => {
      const matchCategory = selectedCategory === "All" || p.data.category === selectedCategory;
      const searchLower = searchQuery.toLowerCase();
      const matchSearch = p.data.name.toLowerCase().includes(searchLower) || 
                          p.data.description.toLowerCase().includes(searchLower) ||
                          p.data.tags?.some(tag => tag.toLowerCase().includes(searchLower));
      return matchCategory && matchSearch;
    });
  }, [allPlugins, searchQuery, selectedCategory]);

  const isLoading = isLoadingAvailable || isLoadingInstalled;

  // Handlers
  const handleInstallClick = (id: string) => {
    if (!canInstall) return;
    const found = allPlugins.find(p => p.data.id === id);
    if (found) {
      setPreviewPlugin(found.data);
      setPreviewCredSchema(found.credSchema);
      setIsInstallPreviewOpen(true);
    }
  };

  const handleConfirmInstall = async (credentials: CredentialInput[]) => {
    if (previewPlugin && canInstall) {
      setIsInstallPreviewOpen(false);
      // Pass credentials vào install — backend sẽ xử lý n8n credential creation
      await installPlugin(previewPlugin.id || "", credentials);
    }
  };

  const handleUninstallClick = (id: string) => {
    if (!canInstall) return;
    const plugin = allPlugins.find(p => p.data.id === id)?.data;
    if (plugin) {
      setUninstallPluginData({ id: plugin.id || "", name: plugin.codeName || plugin.name });
      setIsUninstallConfirmOpen(true);
    }
  };

  const handleConfirmUninstall = async () => {
    if (uninstallPluginData && canInstall) {
      setIsUninstalling(true);
      await uninstallPlugin(uninstallPluginData.id, uninstallPluginData.name);
      setIsUninstalling(false);
      setIsUninstallConfirmOpen(false);
      setUninstallPluginData(null);
      // Refresh list after uninstall
      setTimeout(() => refetchInstalled(), 1000);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-20 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-12 mt-8">
      {/* Hero Section */}
      <div className="card p-8 md:p-12">
        <div className="flex flex-col gap-3 max-w-2xl">
          <div className="mono-tag w-fit">
            <Sparkles className="w-3 h-3" />
            <span>MARKETPLACE</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-grot font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            Khám phá Ứng dụng
          </h1>
          <p className="text-[0.9375rem]" style={{ color: 'var(--muted)' }}>
            Mở rộng khả năng của hệ thống với hàng chục ứng dụng được thiết kế tối ưu cho doanh nghiệp của bạn.
          </p>
        </div>

        <div className="mt-6 w-full">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-bento">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : allPlugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 rounded-2xl text-center" style={{ border: '1px dashed var(--line-hi)' }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: 'var(--paper)', border: '1px solid var(--line-hi)' }}>
              <PackageOpen className="w-10 h-10" style={{ color: 'var(--ghost)' }} />
            </div>
            <h3 className="text-xl font-grot font-bold mb-2" style={{ color: 'var(--ink)' }}>Chưa có Plugin nào trên Marketplace</h3>
            <p style={{ color: 'var(--muted)' }} className="max-w-md">
              Hệ thống hiện chưa có ứng dụng nào được phát hành. Vui lòng quay lại sau.
            </p>
          </div>
        ) : filteredPlugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 rounded-2xl text-center" style={{ border: '1px dashed var(--line-hi)' }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: 'var(--paper)', border: '1px solid var(--line-hi)' }}>
              <PackageOpen className="w-10 h-10" style={{ color: 'var(--ghost)' }} />
            </div>
            <h3 className="text-xl font-grot font-bold mb-2" style={{ color: 'var(--ink)' }}>Không tìm thấy ứng dụng nào</h3>
            <p style={{ color: 'var(--muted)' }} className="max-w-md">
              {searchQuery 
                ? `Không có kết quả nào khớp với "${searchQuery}". Hãy thử tìm kiếm với từ khóa khác.`
                : "Marketplace hiện chưa có ứng dụng nào trong danh mục này."}
            </p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="mt-6 font-medium transition-colors" style={{ color: 'var(--accent)' }}
              >
                Xóa tìm kiếm
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-bento auto-rows-fr">
            {filteredPlugins.map(({ data, status }) => {
              // Override status if this plugin is currently installing
              const currentStatus = installingId === data.id ? (installStatus || status) : status;
              
              return (
                <PluginCard
                  key={data.id}
                  plugin={data}
                  status={currentStatus as PluginStatus}
                  installProgress={installingId === data.id ? installProgress : 0}
                  canInstall={canInstall}
                  onInstall={handleInstallClick}
                  onUninstall={handleUninstallClick}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Install Preview Dialog — với dynamic credential form */}
      <InstallPreviewDialog
        isOpen={isInstallPreviewOpen}
        plugin={previewPlugin}
        credentialsSchema={previewCredSchema}
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
            <div className="text-sm p-4 rounded-xl font-medium" style={{ background: 'var(--rose-fill)', border: '1px solid var(--rose)', color: 'var(--rose)' }}>
              ⚠️ <strong>Cảnh báo nguy hiểm:</strong> Hành động này không thể hoàn tác. 
              Toàn bộ dữ liệu nghiệp vụ, bảng (tables), và workflows liên quan đến ứng dụng này sẽ bị xóa vĩnh viễn khỏi hệ thống.
            </div>
        </div>
      </Modal>
    </div>
  );
};
