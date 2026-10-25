// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { InstallTaskStep } from "@/types";
import { PluginStatus } from "./PluginCard";
import { CheckCircle2, Circle, Loader2, XCircle, Clock } from "lucide-react";

interface InstallProgressModalProps {
  isOpen: boolean;
  pluginName?: string;
  steps: InstallTaskStep[];
  overallProgress: number;
  status: PluginStatus | null;
  onClose: () => void;
}

const STEP_LABELS: Record<string, string> = {
  queued: "Xếp hàng tác vụ",
  snapshot: "Chụp snapshot trạng thái cũ (Rollback)",
  database: "Thiết lập cơ sở dữ liệu (Database)",
  credentials: "Khởi tạo thông tin xác thực (Credentials)",
  n8n: "Nhập luồng công việc tự động (n8n Workflows)",
  metabase: "Nhập bảng điều khiển (Metabase Dashboards)",
  appsmith: "Nhập giao diện người dùng (Appsmith Apps)",
  keycloak: "Đồng bộ phân quyền (Keycloak Roles)",
  events: "Cấu hình sự kiện (Event Pub/Sub)",
  subscriptions: "Gỡ đăng ký sự kiện (Event Subscriptions)",
  complete: "Hoàn tất",
};

// Mô tả chi tiết từng bước để user hiểu hệ thống đang làm gì.
const STEP_DESCRIPTIONS: Record<string, { install: string; uninstall: string }> = {
  queued: {
    install: "Tác vụ cài đặt đã xếp hàng, worker nền bắt đầu thực thi.",
    uninstall: "Tác vụ gỡ cài đặt đã xếp hàng, worker nền bắt đầu thực thi.",
  },
  snapshot: {
    install: "Lưu trạng thái cũ để rollback nếu cài đặt thất bại.",
    uninstall: "Snapshot không áp dụng khi gỡ — bước xác nhận tác vụ.",
  },
  database: {
    install: "Tạo schema tenant, chạy seed SQL, bật RLS.",
    uninstall: "DROP tables của plugin (destructive, không hoàn tác).",
  },
  credentials: {
    install: "Tạo n8n credentials từ thông tin người dùng nhập.",
    uninstall: "Xóa credentials đã tạo trên n8n (nếu có).",
  },
  n8n: {
    install: "Import workflows, inject tenant schema, gắn credentials, activate.",
    uninstall: "Xóa workflows đã import trên n8n.",
  },
  metabase: {
    install: "Import dashboards vào Metabase.",
    uninstall: "Xóa dashboards đã import trên Metabase.",
  },
  appsmith: {
    install: "Import ứng dụng giao diện Appsmith.",
    uninstall: "Xóa ứng dụng Appsmith đã import.",
  },
  keycloak: {
    install: "Tạo Keycloak roles + DB roles cho plugin.",
    uninstall: "Xóa Keycloak roles + DB roles của plugin.",
  },
  events: {
    install: "Đăng ký event subscriptions (Pub/Sub).",
    uninstall: "Xóa event subscriptions và webhooks.",
  },
  subscriptions: {
    install: "Đăng ký event subscriptions (Pub/Sub).",
    uninstall: "Xóa event subscriptions và webhooks.",
  },
  complete: {
    install: "Cài đặt hoàn tất, plugin chuyển sang ACTIVE.",
    uninstall: "Gỡ cài đặt hoàn tất, plugin chuyển sang DELETED.",
  },
};

// Thứ tự chuẩn để render đầy đủ kể cả khi backend chưa log kịp (hiển thị PENDING).
const INSTALL_STEP_ORDER = [
  "queued",
  "snapshot",
  "database",
  "credentials",
  "n8n",
  "metabase",
  "appsmith",
  "keycloak",
  "events",
  "complete",
];

const UNINSTALL_STEP_ORDER = [
  "queued",
  "events",
  "keycloak",
  "appsmith",
  "metabase",
  "n8n",
  "database",
  "complete",
];

function formatTime(at?: string | null): string | null {
  if (!at) return null;
  try {
    const d = new Date(at);
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return null;
  }
}

export const InstallProgressModal: React.FC<InstallProgressModalProps> = ({
  isOpen,
  pluginName,
  steps,
  overallProgress,
  status,
  onClose,
}) => {
  const isBusy =
    status === "installing" || status === "uninstalling" || status === "upgrading";
  const isUninstall = status === "uninstalling";

  const expectedOrder = isUninstall ? UNINSTALL_STEP_ORDER : INSTALL_STEP_ORDER;

  // Gộp steps thực tế từ backend với thứ tự chuẩn → luôn hiển thị đầy đủ
  // các bước chi tiết (PENDING cho bước chưa tới), giúp user thấy toàn cảnh.
  // NOTE: useMemo phải gọi trước early-return để đúng Rules of Hooks.
  const displaySteps: InstallTaskStep[] = useMemo(() => {
    const byStep = new Map(steps.map((s) => [s.step, s]));
    // Giữ các step lạ từ backend (VD: "subscriptions") bằng cách map về "events"
    const normalized = new Map<string, InstallTaskStep>();
    byStep.forEach((v, k) => {
      const key = k === "subscriptions" ? "events" : k;
      // Ưu tiên giữ nguyên nếu đã có key chuẩn
      if (!normalized.has(key)) normalized.set(key, { ...v, step: key });
    });
    const merged: InstallTaskStep[] = expectedOrder.map((key) => {
      const found = normalized.get(key);
      if (found) return found;
      return { step: key, status: "PENDING" as const };
    });
    // Thêm các step backend trả về nhưng không nằm trong order (hiếm)
    normalized.forEach((v, k) => {
      if (!expectedOrder.includes(k)) merged.push(v);
    });
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, isUninstall]);

  const doneCount = displaySteps.filter((s) => s.status === "DONE").length;
  const failedStep = displaySteps.find((s) => s.status === "FAILED");
  const runningStep = displaySteps.find((s) => s.status === "RUNNING");

  // Chặn đóng modal khi đang chạy (backdrop/Escape/X) để user không mất
  // tiến trình polling; hook tự reset installingId khi xong. Chỉ cho đóng
  // khi đã terminal (failed/active) hoặc không còn isOpen.
  const handleClose = () => {
    if (isBusy) return;
    onClose();
  };

  // Only show if we have an active installation sequence
  if (!isOpen && status !== "failed" && status !== "active") return null;

  const title =
    status === "uninstalling"
      ? `Đang gỡ cài đặt ${pluginName || "Plugin"}...`
      : status === "upgrading"
        ? `Đang nâng cấp ${pluginName || "Plugin"}...`
        : status === "failed"
          ? `Cài đặt ${pluginName || "Plugin"} thất bại`
          : status === "active"
            ? `${pluginName || "Plugin"} đã sẵn sàng`
            : `Đang cài đặt ${pluginName || "Plugin"}...`;

  const confirmLabel =
    status === "installing"
      ? "Đang cài đặt..."
      : status === "uninstalling"
        ? "Đang gỡ cài đặt..."
        : status === "upgrading"
          ? "Đang nâng cấp..."
          : status === "active"
            ? "Hoàn tất"
            : "Đóng";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      confirmLabel={confirmLabel}
      isConfirmLoading={
        status === "installing" ||
        status === "uninstalling" ||
        status === "upgrading"
      }
      onConfirm={onClose}
      maxWidth="2xl"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="text-text-secondary">
              Tiến trình tổng thể — {doneCount}/{displaySteps.length} bước
            </span>
            <span className="text-brand-primary">{overallProgress}%</span>
          </div>
          <div className="h-2 w-full bg-border/40 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                status === "failed"
                  ? "bg-danger"
                  : status === "active"
                    ? "bg-success"
                    : "bg-brand-primary"
              }`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          {isBusy && (
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Mỗi bước có delay mô phỏng 1–3s để bạn quan sát chi tiết tiến trình.
                Vui lòng không đóng cửa sổ.
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 bg-bg-surface-elevated p-4 rounded-xl border border-border/50 max-h-[400px] overflow-y-auto">
          {steps.length === 0 && !isBusy && (
            <div className="flex items-center gap-3 text-text-secondary text-sm p-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
              {isUninstall
                ? "Đang khởi tạo tác vụ gỡ cài đặt..."
                : "Đang khởi tạo tác vụ cài đặt..."}
            </div>
          )}

          {displaySteps.map((step, idx) => {
            const isDone = step.status === "DONE";
            const isFailed = step.status === "FAILED";
            const isRunning = step.status === "RUNNING";
            const desc =
              STEP_DESCRIPTIONS[step.step]?.[
                isUninstall ? "uninstall" : "install"
              ];
            const timeLabel = formatTime(step.at);

            return (
              <div
                key={`${step.step}-${idx}`}
                className="flex gap-4 items-start p-2 rounded-lg hover:bg-bg-surface-hover transition-colors"
              >
                <div className="mt-0.5 shrink-0">
                  {isDone && <CheckCircle2 className="w-5 h-5 text-success" />}
                  {isFailed && <XCircle className="w-5 h-5 text-danger" />}
                  {isRunning && (
                    <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
                  )}
                  {!isDone && !isFailed && !isRunning && (
                    <Circle className="w-5 h-5 text-text-tertiary" />
                  )}
                </div>

                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-medium text-sm ${isDone ? "text-text-primary" : isFailed ? "text-danger" : isRunning ? "text-brand-primary" : "text-text-secondary"}`}
                    >
                      Bước {idx + 1}: {STEP_LABELS[step.step] || step.step.toUpperCase()}
                    </span>
                    {timeLabel && (
                      <span className="text-[11px] text-text-tertiary shrink-0 font-mono">
                        {timeLabel}
                      </span>
                    )}
                  </div>

                  {desc && (
                    <span className="text-xs text-text-tertiary">{desc}</span>
                  )}

                  {(step.message || isRunning) && (
                    <span className="text-xs text-text-secondary">
                      {step.message || "Đang xử lý..."}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {failedStep?.message && (
          <div
            className="text-sm p-4 rounded-xl font-medium"
            style={{
              background: "var(--rose-fill)",
              border: "1px solid var(--rose)",
              color: "var(--rose)",
            }}
          >
            ❌ Lỗi tại bước <strong>{STEP_LABELS[failedStep.step] || failedStep.step}</strong>:
            {" "}{failedStep.message}
          </div>
        )}

        {runningStep && isBusy && (
          <div className="text-xs text-text-tertiary text-center">
            Đang thực hiện: <strong>{STEP_LABELS[runningStep.step] || runningStep.step}</strong> — vui
            lòng chờ...
          </div>
        )}
      </div>
    </Modal>
  );
};
