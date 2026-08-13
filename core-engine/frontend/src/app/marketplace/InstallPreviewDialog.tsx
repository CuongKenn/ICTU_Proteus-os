// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { PluginData } from "@/components/ui/PluginCard";

interface InstallPreviewDialogProps {
  isOpen: boolean;
  plugin: PluginData | null;
  onClose: () => void;
  onConfirm: (credentials?: { credential_type: string, credential_name: string, data: Record<string, string> }) => void;
  isConfirmLoading?: boolean;
}

export const InstallPreviewDialog: React.FC<InstallPreviewDialogProps> = ({
  isOpen,
  plugin,
  onClose,
  onConfirm,
  isConfirmLoading = false,
}) => {
  const [showCreds, setShowCreds] = useState(false);
  const [credType, setCredType] = useState("");
  const [credName, setCredName] = useState("");
  const [credData, setCredData] = useState("");
  const [jsonError, setJsonError] = useState("");

  if (!plugin) return null;

  const handleConfirm = () => {
    if (showCreds) {
      if (!credType || !credName || !credData) {
        setJsonError("Vui lòng điền đầy đủ các trường credentials.");
        return;
      }
      try {
        const parsedData = JSON.parse(credData);
        onConfirm({
          credential_type: credType,
          credential_name: credName,
          data: parsedData
        });
      } catch (e) {
        setJsonError("Data không phải là định dạng JSON hợp lệ.");
      }
    } else {
      onConfirm();
    }
  };

  const handleClose = () => {
    setShowCreds(false);
    setCredType("");
    setCredName("");
    setCredData("");
    setJsonError("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Xác nhận cài đặt Plugin"
      onClose={handleClose}
      onConfirm={handleConfirm}
      confirmLabel="Cài đặt"
      confirmVariant="primary"
      isConfirmLoading={isConfirmLoading}
    >
      <div className="flex flex-col gap-4">
        <p>
          Bạn đang chuẩn bị cài đặt <strong>{plugin.name}</strong> (v{plugin.version}). 
          Quá trình này sẽ tự động khởi tạo các tài nguyên hệ thống sau:
        </p>

        <div className="bg-bg-base rounded-lg p-4 border border-border space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">📦</span>
            <div>
              <div className="font-semibold text-text-primary">Database Schema</div>
              <div className="text-xs text-text-secondary">Tạo {plugin.tablesCount} bảng dữ liệu độc lập cho Tenant.</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xl">🔄</span>
            <div>
              <div className="font-semibold text-text-primary">Automation Workflows</div>
              <div className="text-xs text-text-secondary">Đăng ký {plugin.workflowsCount} quy trình tự động trên n8n.</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xl">👤</span>
            <div>
              <div className="font-semibold text-text-primary">RBAC Roles</div>
              <div className="text-xs text-text-secondary">
                Tạo các role: <span className="text-primary font-mono bg-primary/10 px-1 rounded">{plugin.requiredRoles.join(", ")}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border border-border rounded-lg overflow-hidden">
          <label className="flex items-center gap-2 p-3 bg-bg-surface cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={showCreds}
              onChange={(e) => setShowCreds(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span className="font-medium text-sm text-text-primary">Cấu hình Tích hợp (Credentials)</span>
          </label>
          
          {showCreds && (
            <div className="p-4 bg-bg-base border-t border-border flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Credential Type (vd: smtp, githubApi)</label>
                <input 
                  type="text" 
                  value={credType}
                  onChange={(e) => setCredType(e.target.value)}
                  className="w-full bg-bg-surface border border-border rounded p-2 text-sm"
                  placeholder="Loại credential"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Credential Name</label>
                <input 
                  type="text" 
                  value={credName}
                  onChange={(e) => setCredName(e.target.value)}
                  className="w-full bg-bg-surface border border-border rounded p-2 text-sm"
                  placeholder="Tên định danh (vd: my_smtp)"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Data (JSON Format)</label>
                <textarea 
                  value={credData}
                  onChange={(e) => { setCredData(e.target.value); setJsonError(""); }}
                  className="w-full bg-bg-surface border border-border rounded p-2 text-sm font-mono"
                  rows={4}
                  placeholder='{"user": "...", "password": "..."}'
                />
                {jsonError && <div className="text-xs text-danger mt-1">{jsonError}</div>}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-warning bg-warning/10 p-2 rounded border border-warning/20">
          ⚠️ Lưu ý: Quá trình cài đặt có thể mất từ 15-30 giây. Vui lòng không đóng trình duyệt.
        </p>
      </div>
    </Modal>
  );
};
