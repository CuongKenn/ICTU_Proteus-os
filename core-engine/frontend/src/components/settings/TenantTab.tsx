import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { logger } from "@/lib/logger";
import { useNotificationStore } from "@/store/notificationStore";

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  keycloak_realm: string;
  plan: string;
  is_active: boolean;
}

export const TenantTab: React.FC = () => {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ name: "" });

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const res = await api.get<TenantInfo>("/tenants/me");
        setTenant(res.data);
        setFormData({ name: res.data.name });
      } catch (err) {
        logger.error("Failed to fetch tenant info", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTenant();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.patch<TenantInfo>("/tenants/me", { name: formData.name });
      setTenant(res.data);
      useNotificationStore.getState().addToast("success", "Cập nhật thông tin Tenant thành công.");
    } catch (err) {
      logger.error("Failed to update tenant", err);
      useNotificationStore.getState().addToast("error", "Cập nhật thất bại. Hãy chắc chắn bạn là Admin.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col space-y-4 animate-pulse">
        <div className="h-6 w-1/3 bg-bg-surface-elevated rounded"></div>
        <div className="h-10 w-full bg-bg-surface-elevated rounded"></div>
        <div className="h-10 w-full bg-bg-surface-elevated rounded"></div>
      </div>
    );
  }

  if (!tenant) {
    return <div className="text-text-secondary">Không tìm thấy thông tin Tenant.</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-1">Thông tin Tenant</h2>
        <p className="text-sm text-text-secondary">
          Quản lý thông tin tổ chức của bạn.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Tên Tổ Chức (Tenant Name)</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Slug (Định danh)</label>
          <input
            type="text"
            readOnly
            value={tenant.slug}
            className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary cursor-not-allowed opacity-70"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Keycloak Realm</label>
          <input
            type="text"
            readOnly
            value={tenant.keycloak_realm}
            className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary cursor-not-allowed opacity-70"
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Gói dịch vụ (Plan)</label>
          <input
            type="text"
            readOnly
            value={tenant.plan.toUpperCase()}
            className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary cursor-not-allowed opacity-70"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving || formData.name === tenant.name}
            className="px-4 py-2 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
};
