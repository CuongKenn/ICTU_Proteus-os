// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// InstallPreviewDialog — Dynamic Credential Form
// Render form inputs động dựa trên credentials_schema từ manifest.
// Không còn JSON textarea thô — mỗi field được render riêng biệt.

import React, { useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import type { PluginData } from "@/components/marketplace/PluginCard";
import type { CredentialFieldSchema, CredentialInput } from "@/types";

interface InstallPreviewDialogProps {
  isOpen: boolean;
  plugin: PluginData | null;
  credentialsSchema?: CredentialFieldSchema[];
  onClose: () => void;
  /** onConfirm nhận danh sách credentials đã nhập (hoặc [] nếu không có). */
  onConfirm: (credentials: CredentialInput[]) => void;
  isConfirmLoading?: boolean;
}

type CredentialValues = Record<string, string>;

/** Helper: render một input field dựa trên CredentialFieldSchema. */
const CredentialFieldInput: React.FC<{
  field: CredentialFieldSchema;
  value: string;
  onChange: (key: string, value: string) => void;
}> = ({ field, value, onChange }) => {
  const baseClass =
    "w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary " +
    "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors";

  const labelNode = (
    <label className="block text-xs font-medium text-text-secondary mb-1">
      {field.label}
      {field.required && <span className="text-danger ml-1">*</span>}
    </label>
  );

  if (field.type === "select" && field.options) {
    return (
      <div>
        {labelNode}
        <select
          id={`cred-${field.key}`}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={baseClass}
        >
          <option value="">-- Chọn --</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {field.description && (
          <p className="text-xs text-text-secondary mt-1">{field.description}</p>
        )}
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <input
          id={`cred-${field.key}`}
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onChange(field.key, e.target.checked ? "true" : "false")}
          className="rounded border-border text-primary focus:ring-primary w-4 h-4"
        />
        {labelNode}
        {field.description && (
          <p className="text-xs text-text-secondary mt-1">{field.description}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      {labelNode}
      <input
        id={`cred-${field.key}`}
        type={
          field.type === "password"
            ? "password"
            : field.type === "number"
            ? "number"
            : "text"
        }
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder ?? ""}
        className={baseClass}
      />
      {field.description && (
        <p className="text-xs text-text-secondary mt-1">{field.description}</p>
      )}
    </div>
  );
};

export const InstallPreviewDialog: React.FC<InstallPreviewDialogProps> = ({
  isOpen,
  plugin,
  credentialsSchema = [],
  onClose,
  onConfirm,
  isConfirmLoading = false,
}) => {
  const [credValues, setCredValues] = useState<CredentialValues>({});
  const [validationError, setValidationError] = useState("");

  const hasRequiredCreds = credentialsSchema.some((f) => f.required);
  const hasAnyCreds = credentialsSchema.length > 0;

  if (!plugin) return null;

  const handleFieldChange = (key: string, value: string) => {
    setCredValues((prev) => ({ ...prev, [key]: value }));
    if (validationError) setValidationError("");
  };

  const handleConfirm = () => {
    // Validate required fields
    const missingFields = credentialsSchema
      .filter((f) => f.required && !credValues[f.key]?.trim())
      .map((f) => f.label);

    if (missingFields.length > 0) {
      setValidationError(`Vui lòng điền: ${missingFields.join(", ")}`);
      return;
    }

    // Build CredentialInput[]
    const credentials: CredentialInput[] = credentialsSchema
      .filter((f) => credValues[f.key] !== undefined && credValues[f.key] !== "")
      .map((f) => ({
        key: f.key,
        value: credValues[f.key],
        credential_type_name: f.credential_type_name ?? null,
      }));

    onConfirm(credentials);
  };

  const handleClose = useCallback(() => {
    setCredValues({});
    setValidationError("");
    onClose();
  }, [onClose]);

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
        {/* Plugin info */}
        <p>
          Bạn đang chuẩn bị cài đặt{" "}
          <strong className="text-text-primary">{plugin.name}</strong> (v{plugin.version}).
          Quá trình này sẽ tự động khởi tạo các tài nguyên hệ thống sau:
        </p>

        {/* Resources list */}
        <div className="bg-bg-base rounded-lg p-4 border border-border space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">📦</span>
            <div>
              <div className="font-semibold text-sm text-text-primary">Database Schema</div>
              <div className="text-xs text-text-secondary">
                Tạo {plugin.tablesCount ?? 0} bảng dữ liệu độc lập cho Tenant.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl">🔄</span>
            <div>
              <div className="font-semibold text-sm text-text-primary">Automation Workflows</div>
              <div className="text-xs text-text-secondary">
                Đăng ký {plugin.workflowsCount ?? 0} quy trình tự động trên n8n.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl">👤</span>
            <div>
              <div className="font-semibold text-sm text-text-primary">RBAC Roles</div>
              <div className="text-xs text-text-secondary">
                Tạo các role:{" "}
                <span className="text-primary font-mono bg-primary/10 px-1 rounded">
                  {plugin.requiredRoles?.join(", ") || "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Dynamic Credentials Form (từ credentials_schema) ─── */}
        {hasAnyCreds && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-3 bg-bg-surface border-b border-border">
              <span className="text-base">🔑</span>
              <span className="font-medium text-sm text-text-primary">
                Cấu hình Tích hợp (Credentials)
              </span>
              {hasRequiredCreds && (
                <span className="ml-auto text-xs text-danger font-medium">Bắt buộc</span>
              )}
            </div>

            <div className="p-4 bg-bg-base flex flex-col gap-4">
              <p className="text-xs text-text-secondary">
                Plugin này yêu cầu kết nối với dịch vụ bên ngoài.{" "}
                <span className="text-warning">
                  Thông tin credentials sẽ được mã hoá và gửi trực tiếp sang n8n — 
                  không bao giờ lưu vào database của Proteus OS.
                </span>
              </p>

              {credentialsSchema.map((field) => (
                <CredentialFieldInput
                  key={field.key}
                  field={field}
                  value={credValues[field.key] ?? (field.default != null ? String(field.default) : "")}
                  onChange={handleFieldChange}
                />
              ))}

              {validationError && (
                <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded p-2">
                  ⚠️ {validationError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Warning */}
        <p className="text-xs text-warning bg-warning/10 p-2 rounded border border-warning/20">
          ⚠️ Quá trình cài đặt có thể mất từ 15–30 giây. Vui lòng không đóng trình duyệt.
        </p>
      </div>
    </Modal>
  );
};
