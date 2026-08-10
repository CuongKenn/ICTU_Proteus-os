import React from "react";
import { Modal } from "@/components/ui/Modal";
import type { PluginData } from "@/components/ui/PluginCard";

interface InstallPreviewDialogProps {
  isOpen: boolean;
  plugin: PluginData | null;
  onClose: () => void;
  onConfirm: () => void;
  isConfirmLoading?: boolean;
}

export const InstallPreviewDialog: React.FC<InstallPreviewDialogProps> = ({
  isOpen,
  plugin,
  onClose,
  onConfirm,
  isConfirmLoading = false,
}) => {
  if (!plugin) return null;

  return (
    <Modal
      isOpen={isOpen}
      title="Xác nhận cài đặt Plugin"
      onClose={onClose}
      onConfirm={onConfirm}
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
        
        <p className="text-xs text-warning bg-warning/10 p-2 rounded border border-warning/20">
          ⚠️ Lưu ý: Quá trình cài đặt có thể mất từ 15-30 giây. Vui lòng không đóng trình duyệt.
        </p>
      </div>
    </Modal>
  );
};
