// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { useNotificationStore } from "@/store/notificationStore";
import type { InstallTaskStatus } from "@/types";
import type { PluginStatus } from "@/components/ui/PluginCard";

interface UseInstallPluginResult {
  installingId: string | null;
  installProgress: number;
  installStatus: PluginStatus | null;
  installPlugin: (codeName: string) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
}

export function useInstallPlugin(): UseInstallPluginResult {
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStatus, setInstallStatus] = useState<PluginStatus | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const pollStatus = useCallback(async (taskId: string, pluginId: string) => {
    try {
      const response = await api.get<{ data: InstallTaskStatus }>(`/plugins/install/${taskId}/status`);
      const statusData = response.data.data;
      
      if (statusData) {
        // Calculate progress based on steps (mocking if steps is empty)
        let progress = 0;
        if (statusData.steps && statusData.steps.length > 0) {
          const completedSteps = statusData.steps.filter(s => s.status === "DONE").length;
          progress = (completedSteps / statusData.steps.length) * 100;
        } else {
          // Fake progress for mock
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
        // Mocking polling success in dev if API doesn't exist
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
        // Real error handling
        if (pollingRef.current) clearInterval(pollingRef.current);
        setInstallStatus("failed");
        useNotificationStore.getState().addToast("error", "Lỗi khi kiểm tra tiến trình cài đặt.");
        setTimeout(() => setInstallingId(null), 2000);
      }
    }
  }, []);

  const installPlugin = useCallback(async (codeName: string) => {
    setInstallingId(codeName);
    setInstallProgress(0);
    setInstallStatus("installing");

    try {
      const manifestUrl = `https://raw.githubusercontent.com/CuongKenn/ICTU_Proteus-os/main/plugins/${codeName}/manifest.yaml`;
      const response = await api.post<{ data: { task_id: string } }>("/plugins/install", {
        code_name: codeName,
        manifest_url: manifestUrl,
        config_override: null,
      });

      const taskId = response.data?.data?.task_id;
      if (taskId) {
        pollingRef.current = setInterval(() => {
          pollStatus(taskId, codeName);
        }, 3000);
      } else {
        throw new Error("No task_id returned");
      }
    } catch (error) {
      // In dev mode, fake the installation process if API fails
      if (process.env.NODE_ENV === "development") {
        pollingRef.current = setInterval(() => {
          pollStatus("fake-task-id", codeName);
        }, 1000); // faster polling for dev
      } else {
        setInstallStatus("failed");
        useNotificationStore.getState().addToast("error", "Không thể bắt đầu cài đặt Plugin.");
        setInstallingId(null);
      }
    }
  }, [pollStatus]);

  const uninstallPlugin = useCallback(async (pluginId: string) => {
    try {
      await api.delete(`/plugins/${pluginId}`);
      useNotificationStore.getState().addToast("success", "Đã gửi yêu cầu gỡ cài đặt Plugin.");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        useNotificationStore.getState().addToast("success", "Đã gửi yêu cầu gỡ cài đặt Plugin (Mock).");
      } else {
        useNotificationStore.getState().addToast("error", "Không thể gỡ cài đặt Plugin.");
      }
    }
  }, []);

  return {
    installingId,
    installProgress,
    installStatus,
    installPlugin,
    uninstallPlugin,
  };
}
