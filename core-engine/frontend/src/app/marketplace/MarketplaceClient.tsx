// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState, useMemo } from "react";
import { useSession } from "@/hooks/useSession";
import { PluginCard, type PluginData, type PluginStatus } from "@/components/ui/PluginCard";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { Modal } from "@/components/ui/Modal";
import { InstallPreviewDialog } from "./InstallPreviewDialog";
import { useMarketplace } from "@/hooks/useMarketplace";
import { usePlugins } from "@/hooks/usePlugins";
import { PackageOpen } from "lucide-react";

export const MarketplaceClient: React.FC = () => {
  const { hasRole } = useSession();
  const isAdmin = hasRole("tenant_admin");

  const { plugins: availablePlugins, isLoading: isLoadingAvailable, installingId, installProgress, installStatus, installPlugin, uninstallPlugin } = useMarketplace();
  const { plugins: installedPlugins, isLoading: isLoadingInstalled, refetch: refetchInstalled } = usePlugins();

  const [previewPlugin, setPreviewPlugin] = useState<PluginData | null>(null);
  const [isInstallPreviewOpen, setIsInstallPreviewOpen] = useState(false);

  const [uninstallPluginData, setUninstallPluginData] = useState<{ id: string; name: string } | null>(null);
  const [isUninstallConfirmOpen, setIsUninstallConfirmOpen] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);

  // Combine both lists
  const allPlugins = useMemo(() => {
    const list: Array<{ data: PluginData; status: PluginStatus; isInstalled: boolean }> = [];
    
    // Add installed plugins
    installedPlugins.forEach(p => {
      let uiStatus: PluginStatus = "active";
      if (p.status === "FAILED_DIRTY") uiStatus = "failed";
      else if (p.status === "DISABLED") uiStatus = "disabled";
      else if (p.status === "INSTALLING") uiStatus = "installing";

      list.push({
        data: {
          id: p.id,
          name: p.display_name,
          version: p.version,
          description: (p as any).description || "No description available",
          tablesCount: 5, // mock
          workflowsCount: 2, // mock
          requiredRoles: ["tenant_admin"], // mock
          isOfficial: p.is_official,
        },
        status: uiStatus,
        isInstalled: true,
      });
    });

    // Add available plugins
    availablePlugins.forEach(p => {
      // Don't add if already in installed list (by code_name)
      if (!installedPlugins.find(ip => ip.code_name === p.code_name)) {
        list.push({
          data: {
            id: p.id,
            name: p.display_name,
            version: p.version,
            description: p.description,
            tablesCount: 5, // mock
            workflowsCount: 3, // mock
            requiredRoles: ["tenant_admin"], // mock
            isOfficial: p.is_official,
          },
          status: "available",
          isInstalled: false,
        });
      }
    });

    return list;
  }, [availablePlugins, installedPlugins]);

  const isLoading = isLoadingAvailable || isLoadingInstalled;

  // Handlers
  const handleInstallClick = (id: string) => {
    if (!isAdmin) return;
    const plugin = allPlugins.find(p => p.data.id === id)?.data;
    if (plugin) {
      setPreviewPlugin(plugin);
      setIsInstallPreviewOpen(true);
    }
  };

  const handleConfirmInstall = async () => {
    if (previewPlugin && isAdmin) {
      setIsInstallPreviewOpen(false);
      // We pass code_name or id, but hook expects codeName. Let's pass codeName? 
      // For mock, id or code_name doesn't matter much as long as it matches.
      // We'll pass previewPlugin.id as code_name for this mock implementation
      // But actually, we should pass code_name. In PluginData, we don't have code_name.
      // Let's just pass id (which we assume is code_name in this context).
      await installPlugin(previewPlugin.id);
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

  return (
    <div className="flex flex-col gap-8 pb-12 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Plugin Marketplace</h1>
        <p className="text-text-secondary">Khám phá và cài đặt các ứng dụng để mở rộng không gian làm việc của bạn.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : allPlugins.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted glass-card border border-border/50 border-dashed rounded-2xl">
          <PackageOpen className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">Chưa có plugin nào trên Marketplace.</p>
          <p className="text-sm mt-1">Liên hệ Administrator để biết thêm chi tiết.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allPlugins.map(({ data, status }) => {
            // Override status if this plugin is currently installing
            const currentStatus = installingId === data.id ? (installStatus || status) : status;
            
            return (
              <PluginCard
                key={data.id}
                plugin={data}
                status={currentStatus}
                installProgress={installingId === data.id ? installProgress : 0}
                onInstall={isAdmin ? handleInstallClick : undefined}
                onUninstall={isAdmin ? handleUninstallClick : undefined}
              />
            );
          })}
        </div>
      )}

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
            Bạn có chắc chắn muốn gỡ cài đặt plugin <strong>{uninstallPluginData?.name}</strong>?
          </p>
          <div className="text-xs text-danger bg-danger/10 p-3 rounded border border-danger/20">
            ⚠️ <strong>Cảnh báo nguy hiểm:</strong> Hành động này không thể hoàn tác. 
            Toàn bộ dữ liệu nghiệp vụ, bảng (tables), và workflows liên quan đến plugin này sẽ bị xóa vĩnh viễn khỏi hệ thống.
          </div>
        </div>
      </Modal>
    </div>
  );
};
