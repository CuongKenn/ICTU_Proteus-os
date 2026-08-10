// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useNotificationStore } from "@/store/notificationStore";
import type { PluginInfo } from "@/types";

interface UseMarketplaceReturn {
  plugins: PluginInfo[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMarketplace(): UseMarketplaceReturn {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchPlugins = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get<{ data: PluginInfo[] }>("/plugins/marketplace");
        if (!cancelled) {
          setPlugins(response.data.data || []);
        }
      } catch (err: unknown) {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("[useMarketplace] fetch error:", err);
        }
        if (!cancelled) {
          // Fallback mock data in development if backend is not ready
          if (process.env.NODE_ENV === "development") {
            const mockPlugins: PluginInfo[] = [
              {
                id: "1",
                code_name: "hr-module",
                display_name: "Quản lý Nhân sự Pro",
                description: "Quản lý nhân sự toàn diện: chấm công, nghỉ phép, lương.",
                version: "2.1.0",
                author: "ICTU Team",
                is_official: true,
                download_count: 120,
              },
              {
                id: "2",
                code_name: "crm-module",
                display_name: "CRM Tối giản",
                description: "Quản lý khách hàng, cơ hội bán hàng và ticket hỗ trợ.",
                version: "1.0.0",
                author: "ICTU Team",
                is_official: true,
                download_count: 85,
              },
            ];
            setPlugins(mockPlugins);
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

  return {
    plugins,
    isLoading,
    error,
    refetch: () => setTrigger((t) => t + 1),
  };
}
