// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { InstallTaskStep } from "@/types";
import { PluginStatus } from "./PluginCard";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

interface InstallProgressModalProps {
  isOpen: boolean;
  pluginName?: string;
  steps: InstallTaskStep[];
  overallProgress: number;
  status: PluginStatus | null;
  onClose: () => void;
}

const STEP_LABELS: Record<string, string> = {
  queued: "Xếp hàng tác vụ nâng cấp",
  snapshot: "Chụp snapshot trạng thái cũ (Rollback)",
  database: "Thiết lập cơ sở dữ liệu (Database)",
  credentials: "Khởi tạo thông tin xác thực (Credentials)",
  n8n: "Nhập luồng công việc tự động (n8n Workflows)",
  metabase: "Nhập bảng điều khiển (Metabase Dashboards)",
  appsmith: "Nhập giao diện người dùng (Appsmith Apps)",
  keycloak: "Đồng bộ phân quyền (Keycloak Roles)",
  events: "Cấu hình sự kiện (Event Pub/Sub)",
  complete: "Hoàn tất",
};

export const InstallProgressModal: React.FC<InstallProgressModalProps> = ({
  isOpen,
  pluginName,
  steps,
  overallProgress,
  status,
  onClose,
}) => {
  // Only show if we have an active installation sequence
  if (!isOpen && status !== "failed" && status !== "active") return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={status === "uninstalling" ? `Đang gỡ cài đặt ${pluginName || "Plugin"}...` : status === "upgrading" ? `Đang nâng cấp ${pluginName || "Plugin"}...` : `Đang cài đặt ${pluginName || "Plugin"}...`}

      confirmLabel={status === "installing" ? "Đang cài đặt..." : status === "uninstalling" ? "Đang gỡ cài đặt..." : status === "upgrading" ? "Đang nâng cấp..." : status === "active" ? "Hoàn tất" : "Đóng"}
      isConfirmLoading={status === "installing" || status === "uninstalling" || status === "upgrading"}
      onConfirm={onClose}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="text-text-secondary">Tiến trình tổng thể</span>
            <span className="text-brand-primary">{overallProgress}%</span>
          </div>
          <div className="h-2 w-full bg-border/40 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                status === "failed" ? "bg-danger" : status === "active" ? "bg-success" : "bg-brand-primary"
              }`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 bg-bg-surface-elevated p-4 rounded-xl border border-border/50 max-h-[400px] overflow-y-auto">
          {steps.length === 0 && (
            <div className="flex items-center gap-3 text-text-secondary text-sm p-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
              {status === "uninstalling" ? "Đang khởi tạo tác vụ gỡ cài đặt..." : "Đang khởi tạo tác vụ cài đặt..."}
            </div>
          )}
          
          {steps.map((step, idx) => {
            const isDone = step.status === "DONE";
            const isFailed = step.status === "FAILED";
            const isRunning = step.status === "RUNNING";
            
            return (
              <div key={idx} className="flex gap-4 items-start p-2 rounded-lg hover:bg-bg-surface-hover transition-colors">
                <div className="mt-0.5 shrink-0">
                  {isDone && <CheckCircle2 className="w-5 h-5 text-success" />}
                  {isFailed && <XCircle className="w-5 h-5 text-danger" />}
                  {isRunning && <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />}
                  {!isDone && !isFailed && !isRunning && <Circle className="w-5 h-5 text-text-tertiary" />}
                </div>
                
                <div className="flex flex-col gap-1">
                  <span className={`font-medium text-sm ${isDone ? "text-text-primary" : isFailed ? "text-danger" : isRunning ? "text-brand-primary" : "text-text-secondary"}`}>
                    {STEP_LABELS[step.step] || step.step.toUpperCase()}
                  </span>
                  
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
      </div>
    </Modal>
  );
};
