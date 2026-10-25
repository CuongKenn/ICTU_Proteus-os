// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// useMarketplace — Custom Hook quản lý Marketplace
// Tích hợp luồng cài đặt/gỡ cài đặt Plugin (State Machine) từ usePlugins.
// Hiển thị chi tiết từng bước + delay simulation khi polling.

import { useEffect, useState, useCallback, useRef } from "react";
import { getSession } from "next-auth/react";
import api from "@/lib/api";
import { logger } from "@/lib/logger";
import { useNotificationStore } from "@/store/notificationStore";
import { usePlugins } from "@/hooks/usePlugins";
import type {
  PluginInfo,
  InstallTaskStatus,
  InstallTaskStep,
  CredentialInput,
} from "@/types";
import type { PluginStatus } from "@/components/marketplace/PluginCard";

interface UseMarketplaceReturn {
  plugins: PluginInfo[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  // Install/Uninstall Flow State Machine (dùng chung modal chi tiết)
  installingId: string | null;
  installingName: string | null;
  installProgress: number;
  installSteps: InstallTaskStep[];
  installStatus: PluginStatus | null;
  installPlugin: (pluginId: string, credentials?: CredentialInput[]) => Promise<void>;
  uninstallPlugin: (pluginId: string, confirmName?: string) => Promise<void>;
  closeProgress: () => void;
}

// ─── Mock delay simulation: chi tiết từng bước khi ENABLE_MOCKS ───
const MOCK_INSTALL_STEPS: Array<{ step: string; message: string }> = [
  { step: "queued", message: "Tác vụ đã xếp hàng, bắt đầu thực thi." },
  { step: "snapshot", message: "Đã lưu snapshot, sẵn sàng rollback." },
  { step: "database", message: "Đã tạo schema tenant, chạy seed SQL, bật RLS." },
  { step: "credentials", message: "Đã tạo credentials trên n8n." },
  { step: "n8n", message: "Đã import 2 workflows và kích hoạt." },
  { step: "metabase", message: "Đã import 1 dashboard Metabase." },
  { step: "appsmith", message: "Đã import 1 Appsmith app." },
  { step: "keycloak", message: "Đã tạo 2 Keycloak roles + 2 DB roles." },
  { step: "events", message: "Đã đăng ký event subscriptions." },
  { step: "complete", message: "Cài đặt hoàn tất, plugin đã ACTIVE." },
];

const MOCK_UNINSTALL_STEPS: Array<{ step: string; message: string }> = [
  { step: "queued", message: "Tác vụ gỡ cài đặt đã xếp hàng." },
  { step: "events", message: "Đã xóa event subscriptions." },
  { step: "keycloak", message: "Đã xóa phân quyền Keycloak." },
  { step: "appsmith", message: "Đã xóa 1 Appsmith app." },
  { step: "metabase", message: "Đã xóa 1 dashboard." },
  { step: "n8n", message: "Đã xóa 2 workflows n8n." },
  { step: "database", message: "Đã DROP tables của plugin." },
  { step: "complete", message: "Gỡ cài đặt hoàn tất." },
];

// Mỗi bước mock delay 700–1200ms để user quan sát chi tiết.
const MOCK_STEP_DELAY_MIN = 700;
const MOCK_STEP_DELAY_MAX = 1200;

function mockDelay(): number {
  return Math.floor(
    Math.random() * (MOCK_STEP_DELAY_MAX - MOCK_STEP_DELAY_MIN) + MOCK_STEP_DELAY_MIN
  );
}

export function useMarketplace(): UseMarketplaceReturn {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  // Install/Uninstall State Machine
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installingName, setInstallingName] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState(0);
  const [installSteps, setInstallSteps] = useState<InstallTaskStep[]>([]);
  const [installStatus, setInstallStatus] = useState<PluginStatus | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const mockTimersRef = useRef<NodeJS.Timeout[]>([]);
  const flowModeRef = useRef<"install" | "uninstall">("install");

  const { install, uninstall } = usePlugins();

  const clearTimers = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    mockTimersRef.current.forEach(clearTimeout);
    mockTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

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

  const finishFlow = useCallback(
    (status: PluginStatus, toastType: "success" | "error", toastMsg: string) => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setInstallStatus(status);
      if (status === "active") setInstallProgress(100);
      useNotificationStore.getState().addToast(toastType, toastMsg);
      // Giữ modal 2.5s để user đọc bước cuối (complete) rồi mới đóng
      const t = setTimeout(() => {
        setInstallingId(null);
        setInstallingName(null);
        setInstallStatus(null);
        setInstallProgress(0);
        setInstallSteps([]);
      }, 2500);
      mockTimersRef.current.push(t);
    },
    []
  );

  const pollStatus = useCallback(
    async (taskId: string, pluginId: string) => {
      try {
        const response = await api.get<InstallTaskStatus>(`/v1/plugins/install/${taskId}/status`);

        const statusData = response.data;

        if (statusData) {
          // Lưu steps chi tiết từ backend để modal render từng bước
          if (statusData.steps && statusData.steps.length > 0) {
            setInstallSteps(statusData.steps);
            const completedSteps = statusData.steps.filter(
              (s) => s.status === "DONE"
            ).length;
            const realProgress = Math.round((completedSteps / statusData.steps.length) * 100);
            setInstallProgress((prev) => Math.max(prev, realProgress));
          } else {
            // Fallback khi steps rỗng — cap at 95 để luôn còn chỗ cho completion
            setInstallProgress((prev) => Math.min(prev + 5, 95));
          }

          // Check terminal status — dùng overall_status từ API
          const overallStatus = statusData.overall_status;
          const isUninstallFlow = flowModeRef.current === "uninstall";
          if (
            overallStatus === "ACTIVE" ||
            overallStatus === "COMPLETED" ||
            // Gỡ xong backend trả DELETED — cũng là terminal thành công
            (isUninstallFlow && (overallStatus as string) === "DELETED")
          ) {
            finishFlow(
              "active",
              "success",
              isUninstallFlow
                ? "Gỡ cài đặt Plugin thành công!"
                : "Cài đặt Plugin thành công!"
            );
          } else if (
            overallStatus === "FAILED_DIRTY" ||
            overallStatus === "FAILED" ||
            overallStatus === "ROLLING_BACK"
          ) {
            // Giữ steps lỗi để modal hiển thị chi tiết bước FAILED
            if (statusData.steps?.length) setInstallSteps(statusData.steps);
            finishFlow(
              "failed",
              "error",
              isUninstallFlow
                ? "Gỡ cài đặt Plugin thất bại."
                : "Cài đặt Plugin thất bại."
            );
          }
          // Còn lại: INSTALLING / UNINSTALLING / IN_PROGRESS → tiếp tục polling
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
        // 404 ngay sau khi tạo task (DB chưa commit kịp) → bỏ qua vài lần đầu
        if (httpStatus === 404) {
          logger.warn("[useMarketplace] 404 khi poll status — task chưa sẵn sàng, thử lại");
          return;
        }
        // Lỗi thực sự (5xx, network) → dừng polling
        if (pollingRef.current) clearInterval(pollingRef.current);
        setInstallStatus("failed");
        useNotificationStore.getState().addToast("error", "Không thể kiểm tra tiến trình. Vui lòng kiểm tra lại Backend.");
        const t = setTimeout(() => {
          setInstallingId(null);
          setInstallingName(null);
          setInstallStatus(null);
          setInstallProgress(0);
        }, 2500);
        mockTimersRef.current.push(t);
      }
    },
    [finishFlow]
  );

  // ─── Delay simulation cho mock mode: chạy từng bước chi tiết ───
  const runMockSimulation = useCallback(
    (mode: "install" | "uninstall") => {
      const mockSteps = mode === "install" ? MOCK_INSTALL_STEPS : MOCK_UNINSTALL_STEPS;
      let idx = 0;

      const runNext = () => {
        if (idx >= mockSteps.length) {
          finishFlow(
            "active",
            "success",
            mode === "install"
              ? "Cài đặt Plugin thành công (Mock)."
              : "Gỡ cài đặt Plugin thành công (Mock)."
          );
          return;
        }
        const current = mockSteps[idx];
        // Mark RUNNING trước
        setInstallSteps((prev) => {
          const next: InstallTaskStep[] = mockSteps.slice(0, idx + 1).map((m, i) => ({
            step: m.step,
            status: i < idx ? "DONE" : "RUNNING",
            at: new Date().toISOString(),
            message: i < idx ? mockSteps[i].message : "Đang xử lý...",
          }));
          return next;
        });
        const t1 = setTimeout(() => {
          // Mark DONE với message chi tiết
          setInstallSteps((prev) =>
            prev.map((s, i) =>
              i === idx
                ? { ...s, status: "DONE" as const, message: current.message, at: new Date().toISOString() }
                : s
            )
          );
          const progress = Math.round(((idx + 1) / mockSteps.length) * 100);
          setInstallProgress(progress);
          idx += 1;
          const t2 = setTimeout(runNext, 250);
          mockTimersRef.current.push(t2);
        }, mockDelay());
        mockTimersRef.current.push(t1);
      };
      runNext();
    },
    [finishFlow]
  );

  const lookupPluginName = useCallback(
    (pluginId: string) => {
      const found = plugins.find((p) => p.id === pluginId);
      return found?.display_name || found?.code_name || pluginId;
    },
    [plugins]
  );

  const installPlugin = useCallback(
    async (pluginId: string, credentials?: CredentialInput[]) => {
      clearTimers();
      flowModeRef.current = "install";

      setInstallingId(pluginId);
      setInstallingName(lookupPluginName(pluginId));
      setInstallProgress(0);
      setInstallSteps([]);
      setInstallStatus("installing");

      try {
        const data = await install(pluginId, credentials);
        if (data?.task_id) {
          pollingRef.current = setInterval(() => {
            pollStatus(data.task_id, pluginId);
          }, 1500);
          // Poll ngay lần đầu để modal không trống
          pollStatus(data.task_id, pluginId);
        } else {
          throw new Error("No task_id returned");
        }
      } catch (error) {
        if (process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true") {
          runMockSimulation("install");
        } else {
          setInstallStatus("failed");
          useNotificationStore.getState().addToast("error", "Không thể bắt đầu cài đặt Plugin.");
          setInstallingId(null);
          setInstallingName(null);
        }
      }
    },
    [install, pollStatus, clearTimers, runMockSimulation, lookupPluginName]
  );

  const uninstallPlugin = useCallback(
    async (pluginId: string, confirmName?: string) => {
      clearTimers();
      flowModeRef.current = "uninstall";

      setInstallingId(pluginId);
      setInstallingName(confirmName || lookupPluginName(pluginId));
      setInstallProgress(0);
      setInstallSteps([]);
      setInstallStatus("uninstalling");

      try {
        const data = await uninstall(pluginId, confirmName || "");
        const taskId = (data as { task_id?: string } | void)?.task_id;
        if (taskId && !taskId.startsWith("mock-")) {
          pollingRef.current = setInterval(() => {
            pollStatus(taskId, pluginId);
          }, 1500);
          pollStatus(taskId, pluginId);
        } else if (process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true" || taskId?.startsWith("mock-")) {
          // Mock mode hoặc backend mock → delay simulation chi tiết
          runMockSimulation("uninstall");
        } else {
          throw new Error("No task_id returned");
        }
      } catch (error) {
        if (process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true") {
          runMockSimulation("uninstall");
        } else {
          setInstallStatus("failed");
          useNotificationStore.getState().addToast("error", "Không thể bắt đầu gỡ cài đặt Plugin.");
          const t = setTimeout(() => {
            setInstallingId(null);
            setInstallingName(null);
            setInstallStatus(null);
            setInstallProgress(0);
            setInstallSteps([]);
          }, 2500);
          mockTimersRef.current.push(t);
        }
      }
    },
    [uninstall, pollStatus, clearTimers, runMockSimulation, lookupPluginName]
  );

  const closeProgress = useCallback(() => {
    // Chỉ cho đóng khi không còn busy
    if (installStatus === "installing" || installStatus === "uninstalling") return;
    clearTimers();
    setInstallingId(null);
    setInstallingName(null);
    setInstallStatus(null);
    setInstallProgress(0);
    setInstallSteps([]);
  }, [installStatus, clearTimers]);

  return {
    plugins,
    isLoading,
    error,
    refetch: () => setTrigger((t) => t + 1),
    installingId,
    installingName,
    installProgress,
    installSteps,
    installStatus,
    installPlugin,
    uninstallPlugin,
    closeProgress,
  };
}
