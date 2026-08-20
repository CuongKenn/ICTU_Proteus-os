// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Custom Hook — usePlugins ViewModel
// Fetch và quản lý state cho danh sách Plugin.
// Cung cấp các hành động: install, uninstall, disable, upgrade.

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { logger } from "@/lib/logger";
import { useNotificationStore } from "@/store/notificationStore";
import type { Plugin, PluginListResponse } from "@/types";

interface UsePluginsReturn {
  plugins: Plugin[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  install: (pluginId: string) => Promise<{ task_id: string }>;
  uninstall: (pluginId: string, confirmName?: string) => Promise<void>;
  disable: (pluginId: string) => Promise<void>;
  upgrade: (pluginId: string) => Promise<void>;
  configureCredentials: (pluginId: string, payload: { credential_type: string, credential_name: string, data: Record<string, string> }) => Promise<any>;
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
        const response = await api.get<PluginListResponse>("/plugins");
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

  const install = useCallback(async (pluginId: string) => {
    try {
      const response = await api.post<{ data: { task_id: string } }>(`/plugins/${pluginId}/install`, {});
      return response.data.data;
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        return { task_id: "fake-task-id-" + Date.now() };
      }
      throw err;
    }
  }, []);

  const uninstall = useCallback(async (pluginId: string, confirmName?: string) => {
    try {
      await api.delete(`/plugins/${pluginId}/uninstall`, { data: { confirm_name: confirmName || "" } });
      useNotificationStore.getState().addToast("success", "Đã gửi yêu cầu gỡ cài đặt Plugin.");
      refetch();
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        useNotificationStore.getState().addToast("success", "Đã gửi yêu cầu gỡ cài đặt Plugin (Mock).");
        refetch();
      } else {
        useNotificationStore.getState().addToast("error", "Không thể gỡ cài đặt Plugin.");
        throw err;
      }
    }
  }, [refetch]);

  const disable = useCallback(async (pluginId: string) => {
    try {
      await api.post(`/plugins/${pluginId}/disable`, {});
      useNotificationStore.getState().addToast("success", "Đã vô hiệu hoá Plugin.");
      refetch();
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        useNotificationStore.getState().addToast("success", "Đã vô hiệu hoá Plugin (Mock).");
        refetch();
      } else {
        useNotificationStore.getState().addToast("error", "Không thể vô hiệu hoá Plugin.");
        throw err;
      }
    }
  }, [refetch]);

  const upgrade = useCallback(async (pluginId: string) => {
    try {
      await api.post(`/plugins/${pluginId}/upgrade`, {});
      useNotificationStore.getState().addToast("success", "Đang tiến hành nâng cấp Plugin.");
      refetch();
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        useNotificationStore.getState().addToast("success", "Đang tiến hành nâng cấp Plugin (Mock).");
        refetch();
      } else {
        useNotificationStore.getState().addToast("error", "Không thể nâng cấp Plugin.");
        throw err;
      }
    }
  }, [refetch]);

  const configureCredentials = useCallback(async (pluginId: string, payload: { credential_type: string, credential_name: string, data: Record<string, string> }) => {
    try {
      const response = await api.post(`/plugins/${pluginId}/credentials`, payload);
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
    configureCredentials,
  };
}
