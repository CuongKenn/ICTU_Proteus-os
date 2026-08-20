// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// useMarketplace — Custom Hook quản lý Marketplace
// Tích hợp luồng cài đặt Plugin (State Machine) từ usePlugins.

import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { logger } from "@/lib/logger";
import { useNotificationStore } from "@/store/notificationStore";
import { usePlugins } from "@/hooks/usePlugins";
import type { PluginInfo, InstallTaskStatus } from "@/types";
import type { PluginStatus } from "@/components/ui/PluginCard";

interface UseMarketplaceReturn {
  // Install Flow State Machine
  installingId: string | null;
  installProgress: number;
  installStatus: PluginStatus | null;
  installPlugin: (codeName: string) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
}

export function useMarketplace(): UseMarketplaceReturn {

  // Install State Machine
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStatus, setInstallStatus] = useState<PluginStatus | null>(null);
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



  const pollStatus = useCallback(async (taskId: string, pluginId: string) => {
    try {
      const response = await api.get<{ data: InstallTaskStatus }>(`/plugins/install/${taskId}/status`);
      const statusData = response.data.data;
      
      if (statusData) {
        let progress = 0;
        if (statusData.steps && statusData.steps.length > 0) {
          const completedSteps = statusData.steps.filter(s => s.status === "DONE").length;
          progress = (completedSteps / statusData.steps.length) * 100;
        } else {
          setInstallProgress((prev) => Math.min(prev + 10, 90));
        }

        if (progress > 0) {
          setInstallProgress(progress);
        }

        if (statusData.overall_status === "COMPLETED") {
          setInstallProgress(100);
          setInstallStatus("active");
          useNotificationStore.getState().addToast("success", "Cài đặt Plugin thành công!");
          if (pollingRef.current) clearInterval(pollingRef.current);
          setTimeout(() => {
            setInstallingId(null);
            setInstallStatus(null);
            setInstallProgress(0);
          }, 2000);
        } else if (statusData.overall_status === "FAILED" || statusData.overall_status === "ROLLING_BACK") {
          setInstallStatus("failed");
          useNotificationStore.getState().addToast("error", "Cài đặt Plugin thất bại.");
          if (pollingRef.current) clearInterval(pollingRef.current);
          setTimeout(() => {
            setInstallingId(null);
          }, 2000);
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        setInstallProgress((prev) => {
          const next = prev + 30;
          if (next >= 100) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setInstallStatus("active");
            useNotificationStore.getState().addToast("success", "Cài đặt Plugin thành công!");
            setTimeout(() => {
              setInstallingId(null);
              setInstallStatus(null);
              setInstallProgress(0);
            }, 2000);
            return 100;
          }
          return next;
        });
      } else {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setInstallStatus("failed");
        useNotificationStore.getState().addToast("error", "Lỗi khi kiểm tra tiến trình cài đặt.");
        setTimeout(() => setInstallingId(null), 2000);
      }
    }
  }, []);

  const installPlugin = useCallback(async (codeName: string) => {
    // Clear interval cũ nếu có
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    setInstallingId(codeName);
    setInstallProgress(0);
    setInstallStatus("installing");

    try {
      const data = await install(codeName);
      if (data?.task_id) {
        pollingRef.current = setInterval(() => {
          pollStatus(data.task_id, codeName);
        }, 3000);
      } else {
        throw new Error("No task_id returned");
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        pollingRef.current = setInterval(() => {
          pollStatus("fake-task-id", codeName);
        }, 1000);
      } else {
        setInstallStatus("failed");
        useNotificationStore.getState().addToast("error", "Không thể bắt đầu cài đặt Plugin.");
        setInstallingId(null);
      }
    }
  }, [install, pollStatus]);

  return {
    installingId,
    installProgress,
    installStatus,
    installPlugin,
    uninstallPlugin: uninstall,
  };
}
