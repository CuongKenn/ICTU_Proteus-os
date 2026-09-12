// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// useMarketplace — Custom Hook quản lý Marketplace
// Tích hợp luồng cài đặt Plugin (State Machine) từ usePlugins.

import { useEffect, useState, useCallback, useRef } from "react";
import { getSession } from "next-auth/react";
import api from "@/lib/api";
import { logger } from "@/lib/logger";
import { useNotificationStore } from "@/store/notificationStore";
import { usePlugins } from "@/hooks/usePlugins";
import type { PluginInfo, InstallTaskStatus, CredentialInput, InstallTaskStep } from "@/types";
import type { PluginStatus } from "@/components/ui/PluginCard";

interface UseMarketplaceReturn {
  plugins: PluginInfo[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  // Install Flow State Machine
  installingId: string | null;
  installProgress: number;
  installStatus: PluginStatus | null;
  installSteps: InstallTaskStep[];
  installPlugin: (pluginId: string, credentials?: CredentialInput[]) => Promise<void>;
  uninstallPlugin: (pluginId: string, confirmName?: string) => Promise<void>;
}

export function useMarketplace(): UseMarketplaceReturn {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  // Install State Machine
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStatus, setInstallStatus] = useState<PluginStatus | null>(null);
  const [installSteps, setInstallSteps] = useState<InstallTaskStep[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const { install, uninstall } = usePlugins();

  useEffect(() => {
    return () => {
      // Cleanup interval when hook unmounts
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchPlugins = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get<{ items: PluginInfo[]; total: number }>("/v1/plugins");

        if (!cancelled) {
          setPlugins(response.data.items || []);
        }
      } catch (err: unknown) {
        logger.error("[useMarketplace] fetch error:", err);
        if (!cancelled) {
          if (process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true") {
            import("../__tests__/marketplace.mock").then(({ MOCK_PLUGINS }) => {
              setPlugins(MOCK_PLUGINS);
            });
          } else {
            setError("Không thể tải danh sách Plugin. Vui lòng thử lại.");
            useNotificationStore.getState().addToast("error", "Không thể tải danh sách Plugin.");
          }
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

  const pollStatus = useCallback(async (taskId: string, pluginId: string) => {
    try {
      const response = await api.get<InstallTaskStatus>(`/v1/plugins/install/${taskId}/status`);

      const statusData = response.data;

      if (statusData) {
        if (statusData.steps) setInstallSteps(statusData.steps);
        // Tính progress từ steps thực tế
        if (statusData.steps && statusData.steps.length > 0) {
          const completedSteps = statusData.steps.filter(
            (s) => s.status === "DONE"
          ).length;
          const TOTAL_STEPS = 7;
          const realProgress = Math.min(95, Math.round((completedSteps / TOTAL_STEPS) * 100));
          setInstallProgress((prev) => Math.max(prev, realProgress));
        } else {
          // Fallback khi steps rỗng — cap at 95 để luôn còn chỗ cho completion
          setInstallProgress((prev) => Math.min(prev + 5, 95));
        }

        // Check terminal status — dùng overall_status từ API mới
        const overallStatus = statusData.overall_status;
        if (overallStatus === "ACTIVE" || overallStatus === "COMPLETED") {
          setInstallProgress(100);
          setInstallStatus("active");
          useNotificationStore.getState().addToast("success", "Cài đặt Plugin thành công!");
          if (pollingRef.current) clearInterval(pollingRef.current);
          setTimeout(() => {
            setInstallingId(null);
            setInstallStatus(null);
            setInstallProgress(0);
          }, 2000);
        } else if (
          overallStatus === "FAILED_DIRTY" ||
          overallStatus === "FAILED" ||
          overallStatus === "ROLLING_BACK"
        ) {
          setInstallStatus("failed");
          useNotificationStore.getState().addToast("error", "Cài đặt Plugin thất bại.");
          if (pollingRef.current) clearInterval(pollingRef.current);
          setTimeout(() => {
            setInstallingId(null);
            setInstallStatus(null);
            setInstallProgress(0);
          }, 2000);
        }
      }
    } catch (err: any) {
      // 401: token hết hạn — force session refresh và tiếp tục polling
      const httpStatus = err?.response?.status;
      if (httpStatus === 401) {
        logger.warn("[useMarketplace] 401 khi poll status — thử refresh session");
        try {
          await getSession(); // triggers next-auth token refresh
        } catch {
          // ignore — next poll sẽ thử lại tự động
        }
        return; // không dừng polling, thử lại lần sau
      }
      // Lỗi thực sự (5xx, network) → dừng polling
      if (pollingRef.current) clearInterval(pollingRef.current);
      setInstallStatus("failed");
      useNotificationStore.getState().addToast("error", "Không thể kiểm tra tiến trình cài đặt. Vui lòng kiểm tra lại Backend.");
      setTimeout(() => {
        setInstallingId(null);
        setInstallStatus(null);
        setInstallProgress(0);
      }, 2000);
    }
  }, []);

  const installPlugin = useCallback(async (pluginId: string, credentials?: CredentialInput[]) => {
    // Clear interval cũ nếu có
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    setInstallingId(pluginId);
    setInstallProgress(0);
    setInstallSteps([]);
    setInstallStatus("installing");

    try {
      const data = await install(pluginId, credentials);
      if (data?.task_id) {
        pollingRef.current = setInterval(() => {
          pollStatus(data.task_id, pluginId);
        }, 3000);
      } else {
        throw new Error("No task_id returned");
      }
    } catch (error) {
      if (process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true") {
        // Simulate install progress locally
        let mockProgress = 0;
        pollingRef.current = setInterval(() => {
          mockProgress += 20;
          setInstallProgress(mockProgress);
          if (mockProgress >= 100) {
            clearInterval(pollingRef.current!);
            setInstallStatus("active");
            useNotificationStore.getState().addToast("success", "Cài đặt Plugin thành công (Mock).");
            setTimeout(() => {
              setInstallingId(null);
              setInstallStatus(null);
              setInstallProgress(0);
            }, 2000);
          }
        }, 500);
      } else {
        setInstallStatus("failed");
        useNotificationStore.getState().addToast("error", "Không thể bắt đầu cài đặt Plugin.");
        setInstallingId(null);
      }
    }
  }, [install, pollStatus]);

  return {
    plugins,
    isLoading,
    error,
    refetch: () => setTrigger((t) => t + 1),
    installingId,
    installProgress,
    installStatus,
    installSteps,
    installPlugin,
    uninstallPlugin: useCallback(async (pluginId: string, confirmName: string = '') => {
      setInstallingId(pluginId);
      setInstallProgress(0);
      setInstallSteps([]);
      setInstallStatus("uninstalling" as PluginStatus);

      try {
        const { default: api } = await import("@/lib/api");
        const res = await api.delete(`/v1/plugins/${pluginId}/uninstall`, { data: { confirm_name: confirmName } });
        const data = res.data;
        const taskId = data.task_id;
        
        if (taskId) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          
          pollingRef.current = setInterval(async () => {
            try {
              const statusRes = await api.get(`/v1/plugins/install/${taskId}/status`);
              const statusData = statusRes.data;

              if (statusData.steps && statusData.steps.length > 0) {
                setInstallSteps(statusData.steps);
                const completedSteps = statusData.steps.filter((s: any) => s.status === "DONE").length;
                const TOTAL_STEPS = 6;
                const realProgress = Math.min(95, Math.round((completedSteps / TOTAL_STEPS) * 100));
                setInstallProgress((prev) => Math.max(prev, realProgress));
              } else {
                setInstallProgress((prev) => Math.min(prev + 5, 95));
              }

              const overallStatus = statusData.overall_status;
              if (overallStatus === "DELETED" || overallStatus === "COMPLETED") {
                setInstallProgress(100);
                setInstallStatus("active");
                useNotificationStore.getState().addToast("success", "Gỡ cài đặt Plugin thành công!");
                if (pollingRef.current) clearInterval(pollingRef.current);
                setTimeout(() => {
                  setInstallingId(null);
                  setInstallStatus(null);
                  setInstallProgress(0);
                  setTrigger(t => t + 1);
                }, 2000);
              } else if (overallStatus === "FAILED" || overallStatus === "FAILED_DIRTY") {
                setInstallStatus("failed");
                useNotificationStore.getState().addToast("error", "Gỡ cài đặt Plugin thất bại.");
                if (pollingRef.current) clearInterval(pollingRef.current);
                setTimeout(() => {
                  setInstallingId(null);
                  setInstallStatus(null);
                  setInstallProgress(0);
                }, 2000);
              }
            } catch (err) {
              // console.error("Polling error", err);
            }
          }, 3000);
        } else {
          // Fallback if backend doesn't return task_id (e.g., still old code)
          useNotificationStore.getState().addToast("success", "Gỡ cài đặt Plugin thành công!");
          setInstallingId(null);
          setInstallStatus(null);
          setTrigger(t => t + 1);
        }
      } catch (err: any) {
        setInstallStatus("failed");
        useNotificationStore.getState().addToast("error", "Không thể gỡ cài đặt Plugin.");
        setTimeout(() => {
          setInstallingId(null);
          setInstallStatus(null);
          setInstallProgress(0);
        }, 2000);
        throw err;
      }
    }, []),
  };
}
