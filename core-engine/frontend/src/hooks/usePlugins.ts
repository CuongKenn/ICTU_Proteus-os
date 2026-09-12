// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Custom Hook — usePlugins ViewModel
// Fetch và quản lý state cho danh sách Plugin.
// Cung cấp các hành động: install, uninstall, disable, upgrade.

import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { logger } from "@/lib/logger";
import { useNotificationStore } from "@/store/notificationStore";
import type { Plugin, PluginListResponse, CredentialInput, InstallTaskStatus, InstallTaskStep } from "@/types";

interface UsePluginsReturn {
  plugins: Plugin[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  install: (pluginId: string, credentials?: CredentialInput[]) => Promise<{ task_id: string }>;
  uninstall: (pluginId: string, confirmName?: string) => Promise<void>;
  disable: (pluginId: string, confirmName?: string) => Promise<void>;
  upgrade: (pluginId: string) => Promise<void>;
  upgradingId: string | null;
  upgradeProgress: number;
  upgradeStatus: "upgrading" | "active" | "failed" | null;
  upgradeSteps: InstallTaskStep[];
  configureCredentials: (pluginId: string, payload: { credential_type: string, credential_name: string, data: Record<string, string> }) => Promise<unknown>;
}

export function usePlugins(): UsePluginsReturn {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    const fetchPlugins = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get<PluginListResponse>("/v1/plugins/installed");

        if (!cancelled) {
          setPlugins(response.data.items);
        }
      } catch (err: unknown) {
        logger.error("[usePlugins] fetch error:", err);
        if (!cancelled) {
          setError("Không thể tải danh sách Plugin. Vui lòng thử lại.");
          useNotificationStore.getState().addToast("error", "Không thể tải danh sách Plugin.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchPlugins();
    return () => { cancelled = true; };
  }, [trigger]);

  const install = useCallback(async (pluginId: string, credentials?: CredentialInput[]) => {
    try {
      const response = await api.post<{ task_id: string }>(`/v1/plugins/${pluginId}/install`, {

        credentials: credentials ?? [],
      });
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  const uninstall = useCallback(async (pluginId: string, confirmName: string = '') => {
    try {
      await api.delete(`/v1/plugins/${pluginId}/uninstall`, { data: { confirm_name: confirmName } });

      useNotificationStore.getState().addToast("success", "Gỡ cài đặt Plugin thành công!");
      refetch();
    } catch (err) {
      if (process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true") {
        import("../__tests__/plugins.mock").then(({ MOCK_TOASTS }) => {
          useNotificationStore.getState().addToast("success", MOCK_TOASTS.uninstall);
          refetch();
        });
      } else {
        useNotificationStore.getState().addToast("error", "Không thể gỡ cài đặt Plugin.");
        throw err;
      }
    }
  }, [refetch]);

  const disable = useCallback(async (pluginId: string) => {
    try {
      await api.post(`/v1/plugins/${pluginId}/disable`, {});

      useNotificationStore.getState().addToast("success", "Đã vô hiệu hoá Plugin.");
      refetch();
    } catch (err) {
      if (process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true") {
        import("../__tests__/plugins.mock").then(({ MOCK_TOASTS }) => {
          useNotificationStore.getState().addToast("success", MOCK_TOASTS.disable);
          refetch();
        });
      } else {
        useNotificationStore.getState().addToast("error", "Không thể vô hiệu hoá Plugin.");
        throw err;
      }
    }
  }, [refetch]);

  // ─── Upgrade (async + polling, mirror install flow) ──────────────
  const [upgradingId, setUpgradingId] = useState<string | null>(null);
  const [upgradeProgress, setUpgradeProgress] = useState(0);
  const [upgradeStatus, setUpgradeStatus] = useState<"upgrading" | "active" | "failed" | null>(null);
  const [upgradeSteps, setUpgradeSteps] = useState<InstallTaskStep[]>([]);
  const upgradingRef = useRef<NodeJS.Timeout | null>(null);

  const stopUpgradePolling = useCallback(() => {
    if (upgradingRef.current) {
      clearInterval(upgradingRef.current);
      upgradingRef.current = null;
    }
  }, []);

  useEffect(() => () => stopUpgradePolling(), [stopUpgradePolling]);

  const pollUpgrade = useCallback(async (taskId: string) => {
    try {
      const response = await api.get<InstallTaskStatus>(`/v1/plugins/upgrade/${taskId}/status`);
      const data = response.data;
      if (!data) return;
      if (data.steps) setUpgradeSteps(data.steps);
      if (data.steps && data.steps.length > 0) {
        const done = data.steps.filter((s) => s.status === "DONE").length;
        const TOTAL_STEPS = 7; // snapshot/database/n8n/metabase/appsmith/keycloak/complete
        setUpgradeProgress((prev) => Math.max(prev, Math.min(95, Math.round((done / TOTAL_STEPS) * 100))));
      } else {
        setUpgradeProgress((prev) => Math.min(prev + 5, 95));
      }
      const st = (data as any).overall_status as string | undefined;
      if (st === "ACTIVE") {
        setUpgradeProgress(100);
        setUpgradeStatus("active");
        useNotificationStore.getState().addToast("success", "Nâng cấp Plugin thành công!");
        stopUpgradePolling();
        refetch();
        setTimeout(() => {
          setUpgradingId(null);
          setUpgradeStatus(null);
          setUpgradeProgress(0);
        }, 2000);
      } else if (st === "FAILED_DIRTY" || st === "FAILED") {
        setUpgradeStatus("failed");
        useNotificationStore.getState().addToast("error", "Nâng cấp Plugin thất bại. Bấm Thử lại để chạy lại.");
        stopUpgradePolling();
        refetch();
        setTimeout(() => {
          setUpgradingId(null);
          setUpgradeStatus(null);
          setUpgradeProgress(0);
        }, 4000);
      }
    } catch (err) {
      // 401/transient — giữ polling, thử lại lần sau
      logger.warn("[usePlugins] upgrade poll failed, retrying", err);
    }
  }, [refetch, stopUpgradePolling]);

  const upgrade = useCallback(async (pluginId: string) => {
    try {
      const response = await api.post<{ task_id: string }>(`/v1/plugins/${pluginId}/upgrade`, {});
      const taskId = response.data?.task_id;
      if (!taskId) throw new Error("Missing upgrade task_id");
      setUpgradingId(pluginId);
      setUpgradeStatus("upgrading");
      setUpgradeProgress(0);
      setUpgradeSteps([]);
      stopUpgradePolling();
      upgradingRef.current = setInterval(() => pollUpgrade(taskId), 3000);
    } catch (err) {
      if (process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true") {
        import("../__tests__/plugins.mock").then(({ MOCK_TOASTS }) => {
          useNotificationStore.getState().addToast("success", MOCK_TOASTS.upgrade);
          refetch();
        });
      } else {
        useNotificationStore.getState().addToast("error", "Không thể nâng cấp Plugin.");
        throw err;
      }
    }
  }, [refetch, pollUpgrade, stopUpgradePolling]);

  const configureCredentials = useCallback(async (pluginId: string, payload: { credential_type: string, credential_name: string, data: Record<string, string> }) => {
    try {
      const response = await api.post(`/v1/plugins/${pluginId}/credentials`, payload);

      useNotificationStore.getState().addToast("success", "Cấu hình Credentials thành công.");
      return response.data;
    } catch (err) {
      useNotificationStore.getState().addToast("error", "Không thể cấu hình Credentials.");
      throw err;
    }
  }, []);

  return {
    plugins,
    isLoading,
    error,
    refetch,
    install,
    uninstall,
    disable,
    upgrade,
    upgradingId,
    upgradeProgress,
    upgradeStatus,
    upgradeSteps,
    configureCredentials,
  };
}
