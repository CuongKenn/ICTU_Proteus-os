// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { useRBAC } from "@/hooks/useRBAC";
import { PluginCard, type PluginData, type PluginStatus } from "@/components/marketplace/PluginCard";
import { CategoryFilter } from "@/components/marketplace/CategoryFilter";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { Modal } from "@/components/ui/Modal";
import { InstallPreviewDialog } from "./InstallPreviewDialog";
import { InstallProgressModal } from "@/components/marketplace/InstallProgressModal";
import { useMarketplace } from "@/hooks/useMarketplace";
import { usePlugins } from "@/hooks/usePlugins";
import { PackageOpen, Sparkles, LayoutGrid, CheckCircle2, ArrowUpCircle, ArrowDownWideNarrow, AlertTriangle, SearchX } from "lucide-react";
import type { CredentialFieldSchema, CredentialInput } from "@/types";

const CATEGORIES = ["HR", "CRM", "Finance", "Utilities", "Analytics", "Communication"];

/** So sánh semver đơn giản: -1 nếu a<b, 0 nếu bằng, 1 nếu a>b. */
const compareVersions = (a?: string | null, b?: string | null): number => {
  const pa = (a ?? "").split(".").map((x) => parseInt(x, 10) || 0);
  const pb = (b ?? "").split(".").map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length, 1);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
};

export const MarketplaceClient: React.FC = () => {
  useSession();
  const { hasPermission, isLoading: isRBACLoading } = useRBAC();
  const canInstall = hasPermission("plugins:install");

  const { plugins: availablePlugins, isLoading: isLoadingAvailable, installingId, installProgress, installStatus, installSteps, installPlugin, uninstallPlugin } = useMarketplace();
  const { plugins: installedPlugins, isLoading: isLoadingInstalled, refetch: refetchInstalled, upgrade: upgradePlugin, upgradingId, upgradeProgress, upgradeStatus, upgradeSteps } = usePlugins();
  const canUpgrade = hasPermission("plugins:upgrade");

  const [previewPlugin, setPreviewPlugin] = useState<PluginData | null>(null);
  const [previewCredSchema, setPreviewCredSchema] = useState<CredentialFieldSchema[]>([]);
  const [isInstallPreviewOpen, setIsInstallPreviewOpen] = useState(false);

  useEffect(() => {
    if (installStatus === null && !installingId) {
      refetchInstalled();
    }
  }, [installStatus, installingId, refetchInstalled]);

  const [uninstallPluginData, setUninstallPluginData] = useState<{ id: string; name: string } | null>(null);
  const [isUninstallConfirmOpen, setIsUninstallConfirmOpen] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"name" | "installed" | "updates">("name");

  const allPlugins = useMemo(() => {
    const list: Array<{ data: PluginData; credSchema: CredentialFieldSchema[]; status: PluginStatus; isInstalled: boolean }> = [];

    // Add installed plugins
    installedPlugins.forEach(p => {
      let uiStatus: PluginStatus = "active";
      if (p.status === "FAILED_DIRTY") uiStatus = "failed";
      else if (p.status === "DISABLED") uiStatus = "disabled";
      else if (p.status === "INSTALLING") uiStatus = "installing";
      else if (p.status === "UNINSTALLING" as any) uiStatus = "uninstalling" as any;
      else if (p.status === "PENDING_CREDENTIALS") uiStatus = "failed"; // show as warning
      else if (p.status === "UPGRADING" as any) uiStatus = "upgrading";
      else {
        // So sánh installed_version (DB) với version mới nhất trên Marketplace
        const twin = availablePlugins.find(ap => ap.code_name === p.code_name);
        if (canUpgrade && twin && p.installed_version && compareVersions(p.installed_version, twin.version) < 0) {
          uiStatus = "update_available";
        }
      }

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
  }, [availablePlugins, installedPlugins, canUpgrade]);

  // Filter plugins based on search and category (+ sắp xếp)
  const filteredPlugins = useMemo(() => {
    const list = allPlugins.filter(p => {
      const matchCategory = selectedCategory === "All" || p.data.category === selectedCategory;
      const searchLower = searchQuery.toLowerCase();
      const matchSearch = p.data.name.toLowerCase().includes(searchLower) || 
                          p.data.description.toLowerCase().includes(searchLower) ||
                          p.data.tags?.some(tag => tag.toLowerCase().includes(searchLower));
      return matchCategory && matchSearch;
    });
    return [...list].sort((a, b) => {
      if (sortBy === "installed") return Number(b.isInstalled) - Number(a.isInstalled);
      if (sortBy === "updates") {
        const au = a.status === "update_available" ? 0 : 1;
        const bu = b.status === "update_available" ? 0 : 1;
        return au - bu;
      }
      return a.data.name.localeCompare(b.data.name, "vi");
    });
  }, [allPlugins, searchQuery, selectedCategory, sortBy]);

  const installedCount = useMemo(() => allPlugins.filter((p) => p.isInstalled).length, [allPlugins]);
  const updateCount = useMemo(() => allPlugins.filter((p) => p.status === "update_available").length, [allPlugins]);

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

  const handleUpdateClick = async (id: string) => {
    if (!canUpgrade) return;
    try {
      await upgradePlugin(id);
    } catch {
      // toast đã xử lý trong hook
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
    <div className="flex flex-col gap-6 pb-20 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8">
      {/* Hero Section — trắng thoáng, chữ lớn */}
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:p-8 dark:border-border/60 dark:bg-gradient-to-br dark:from-bg-surface dark:via-bg-surface/80 dark:to-bg-base dark:shadow-none">
        {/* Decorative background elements */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-200/50 blur-[80px] dark:bg-brand-primary/15" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-cyan-100/60 blur-[80px] dark:bg-brand-secondary/10" />
        
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 max-w-2xl flex-col gap-3">
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-indigo-600/20 bg-indigo-600/[0.07] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:border-brand-primary/25 dark:bg-brand-primary/10 dark:text-brand-primary">
              <Sparkles className="h-3.5 w-3.5" /> App Store
            </p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 text-balance sm:text-4xl dark:text-text-primary">
              Khám phá Ứng dụng
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-slate-500 sm:text-[15px] dark:text-text-secondary">
              Mở rộng khả năng của hệ thống với các ứng dụng được thiết kế tối ưu cho doanh nghiệp của bạn.
            </p>
          </div>
          <dl className="grid shrink-0 grid-cols-3 gap-6 sm:gap-8" aria-label="Thống kê marketplace">
            <div className="flex flex-col text-left">
              <dd className="order-1 font-display text-3xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-4xl dark:text-text-primary">{allPlugins.length}</dd>
              <dt className="order-2 mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-text-secondary">
                <LayoutGrid className="h-3.5 w-3.5 text-indigo-500 dark:text-brand-primary" /> tất cả
              </dt>
            </div>
            <div className="flex flex-col text-left">
              <dd className="order-1 font-display text-3xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-4xl dark:text-text-primary">{installedCount}</dd>
              <dt className="order-2 mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-text-secondary">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-success" /> đã cài
              </dt>
            </div>
            <div className="flex flex-col text-left">
              <dd className="order-1 font-display text-3xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-4xl dark:text-text-primary">{updateCount}</dd>
              <dt className="order-2 mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-text-secondary">
                <ArrowUpCircle className="h-3.5 w-3.5 text-amber-500" /> có update
              </dt>
            </div>
          </dl>
        </div>

        <div className="relative z-10 mt-5 flex flex-col gap-3">
          <CategoryFilter 
            categories={CATEGORIES}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-text-secondary">
            <ArrowDownWideNarrow className="h-3.5 w-3.5" />
            <span id="marketplace-sort-label" className="font-semibold">Sắp xếp:</span>
            <div role="group" aria-labelledby="marketplace-sort-label" className="flex gap-1.5">
              {([
                { id: "name", label: "Tên A–Z" },
                { id: "installed", label: "Đã cài trước" },
                { id: "updates", label: "Có update trước" },
              ] as const).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSortBy(o.id)}
                  aria-pressed={sortBy === o.id}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                    sortBy === o.id
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-sm dark:border-brand-primary/70 dark:bg-brand-primary/15 dark:text-brand-primary dark:shadow-none"
                      : "border-slate-200 bg-white text-slate-500 shadow-sm hover:border-indigo-300 hover:text-slate-900 dark:border-border/60 dark:bg-transparent dark:text-text-secondary dark:shadow-none dark:hover:border-brand-primary/40 dark:hover:text-text-primary"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
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
        ) : allPlugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-24 text-center sm:py-28 dark:border-border/60 dark:bg-bg-surface/30">
            <div className="relative mb-6 inline-flex h-24 w-24 items-center justify-center rounded-[28px] bg-indigo-600/[0.08] ring-1 ring-indigo-600/15 dark:border dark:border-brand-primary/25 dark:bg-gradient-to-br dark:from-brand-primary/15 dark:via-bg-surface dark:to-brand-secondary/10 dark:ring-0">
              <PackageOpen className="relative z-10 h-11 w-11 text-indigo-600 dark:text-brand-primary" />
            </div>
            <h3 className="mb-2 font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-text-primary">Chưa có Plugin nào trên Marketplace</h3>
            <p className="max-w-md text-sm leading-relaxed text-slate-500 dark:text-text-secondary">
              Hệ thống hiện chưa có ứng dụng nào được phát hành. Vui lòng quay lại sau.
            </p>
          </div>
        ) : filteredPlugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white px-6 py-24 text-center shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:py-28 dark:border-border/60 dark:bg-bg-surface/40 dark:shadow-none" role="status">
            <div className="relative mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600/[0.08] ring-1 ring-indigo-600/15 dark:border dark:border-brand-primary/25 dark:bg-gradient-to-br dark:from-brand-primary/15 dark:to-brand-secondary/10 dark:ring-0">
              <SearchX className="relative z-10 h-9 w-9 text-indigo-600 dark:text-brand-primary" />
            </div>
            <h3 className="mb-2 font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-text-primary">Không tìm thấy ứng dụng nào</h3>
            <p className="max-w-md text-sm leading-relaxed text-slate-500 dark:text-text-secondary">
              {searchQuery 
                ? `Không có kết quả nào khớp với "${searchQuery}". Hãy thử tìm kiếm với từ khóa khác.`
                : "Marketplace hiện chưa có ứng dụng nào trong danh mục này."}
            </p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-10px_rgba(79,70,229,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-500 active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base dark:bg-brand-primary dark:hover:bg-primary-hover dark:shadow-[0_8px_24px_-8px_hsla(245,85%,65%,0.6)]"
              >
                Xóa tìm kiếm
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-fr">
            {filteredPlugins.map(({ data, status }) => {
              // Override status if this plugin is currently installing/upgrading
              let currentStatus = installingId === data.id ? (installStatus || status) : status;
              if (upgradingId === data.id) currentStatus = (upgradeStatus || "upgrading") as PluginStatus;

              return (
                <PluginCard
                  key={data.id}
                  plugin={data}
                  status={currentStatus as PluginStatus}
                  installProgress={installingId === data.id ? installProgress : upgradingId === data.id ? upgradeProgress : 0}
                  canInstall={canInstall}
                  onInstall={handleInstallClick}
                  onUninstall={handleUninstallClick}
                  onUpdate={handleUpdateClick}
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


      <InstallProgressModal
        isOpen={!!installingId}
        pluginName={allPlugins.find(p => p.data.id === installingId)?.data.name}
        steps={installSteps}
        overallProgress={installProgress}
        status={installStatus}
        onClose={() => {
          // Hook tự reset installingId/installStatus sau 2s khi xong.
          // Chặn đóng thủ công khi đang installing/uninstalling (guard thêm
          // trong InstallProgressModal); khi failed/active modal tự ẩn.
        }}
      />

      <InstallProgressModal
        isOpen={!!upgradingId}
        pluginName={allPlugins.find(p => p.data.id === upgradingId)?.data.name}
        steps={upgradeSteps}
        overallProgress={upgradeProgress}
        status={upgradeStatus}
        onClose={() => {
          // Tương tự install: chặn đóng khi upgrading, tự ẩn khi xong.
        }}
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
          <div className="flex items-start gap-2 text-sm text-danger bg-danger/10 p-4 rounded-xl border border-danger/20 font-medium">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p><strong>Cảnh báo nguy hiểm:</strong> Hành động này không thể hoàn tác. 
            Toàn bộ dữ liệu nghiệp vụ, bảng (tables), và workflows liên quan đến ứng dụng này sẽ bị xóa vĩnh viễn khỏi hệ thống.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
