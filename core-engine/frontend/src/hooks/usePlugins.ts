// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Custom Hook — usePlugins ViewModel
// Fetch và quản lý state cho danh sách Plugin.
// Tách biệt Business Logic khỏi UI Component (MVVM-like pattern).

import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { Plugin, PluginListResponse } from "@/types";

interface UsePluginsReturn {
  plugins: Plugin[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePlugins(): UsePluginsReturn {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchPlugins = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get<PluginListResponse>("/plugins/installed");
        if (!cancelled) {
          setPlugins(response.data.items);
        }
      } catch (err: unknown) {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("[usePlugins] fetch error:", err);
        }
        if (!cancelled) {
          setError("Không thể tải danh sách Plugin. Vui lòng thử lại.");
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
