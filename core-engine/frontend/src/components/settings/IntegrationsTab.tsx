import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { logger } from "@/lib/logger";
import { useNotificationStore } from "@/store/notificationStore";
import { MessageSquare, Database, BookOpen, Plus, Settings } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface IntegrationInfo {
  id: string;
  tenant_id: string;
  provider: string;
  config_data: Record<string, any>;
  is_active: boolean;
}

const PROVIDERS = [
  { id: "mattermost", name: "Mattermost", icon: MessageSquare, desc: "Tích hợp chat và thông báo" },
  { id: "metabase", name: "Metabase", icon: Database, desc: "Tích hợp BI Dashboard" },
  { id: "outline", name: "Outline", icon: BookOpen, desc: "Tích hợp Knowledge Base" },
];

export const IntegrationsTab: React.FC = () => {
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [configData, setConfigData] = useState<string>("{\n  \n}");
  const [isSaving, setIsSaving] = useState(false);

  const fetchIntegrations = async () => {
    try {
      const res = await api.get<IntegrationInfo[]>("/tenants/integrations");
      setIntegrations(res.data);
    } catch (err) {
      logger.error("Failed to fetch integrations", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleOpenConfig = (providerId: string) => {
    setSelectedProvider(providerId);
    const existing = integrations.find(i => i.provider === providerId);
    if (existing) {
      setConfigData(JSON.stringify(existing.config_data, null, 2));
    } else {
      setConfigData("{\n  \n}");
    }
    setIsModalOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedProvider) return;
    
    let parsedConfig = {};
    try {
      parsedConfig = JSON.parse(configData);
    } catch (e) {
      useNotificationStore.getState().addToast("error", "Cấu hình JSON không hợp lệ.");
      return;
    }

    setIsSaving(true);
    try {
      await api.post("/tenants/integrations", {
        provider: selectedProvider,
        config_data: parsedConfig,
        is_active: true
      });
      useNotificationStore.getState().addToast("success", "Lưu cấu hình thành công.");
      setIsModalOpen(false);
      fetchIntegrations();
    } catch (err) {
      logger.error("Failed to save integration", err);
      useNotificationStore.getState().addToast("error", "Không thể lưu cấu hình.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col space-y-4 animate-pulse">
        <div className="h-6 w-1/3 bg-bg-surface-elevated rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-24 w-full bg-bg-surface-elevated rounded"></div>
          <div className="h-24 w-full bg-bg-surface-elevated rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-1">Tích hợp & Kết nối (Integrations)</h2>
        <p className="text-sm text-text-secondary">
          Cấu hình kết nối với các hệ thống ngoài (Mattermost, Metabase, Outline...) cho Tenant của bạn.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {PROVIDERS.map((provider) => {
          const Icon = provider.icon;
          const existing = integrations.find(i => i.provider === provider.id);
          const isActive = existing?.is_active;

          return (
            <div key={provider.id} className="p-5 bg-bg-surface border border-border rounded-xl flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${isActive ? "bg-brand-primary/10 text-brand-primary" : "bg-bg-surface-elevated text-text-muted"}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-text-primary">{provider.name}</h3>
                  <p className="text-xs text-text-secondary mt-0.5">{provider.desc}</p>
                </div>
              </div>
              
              <div className="mt-auto pt-2 flex items-center justify-between border-t border-border/50">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${isActive ? "bg-success/10 text-success" : "bg-text-muted/10 text-text-muted"}`}>
                  {isActive ? "Đã kết nối" : "Chưa kết nối"}
                </span>
                <button
                  onClick={() => handleOpenConfig(provider.id)}
                  className="flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:text-brand-primary/80 transition-colors"
                >
                  {isActive ? <><Settings className="w-4 h-4" /> Cấu hình</> : <><Plus className="w-4 h-4" /> Kết nối</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Cấu hình ${PROVIDERS.find(p => p.id === selectedProvider)?.name}`}
        onConfirm={handleSaveConfig}
        confirmLabel={isSaving ? "Đang lưu..." : "Lưu cấu hình"}
        isConfirmLoading={isSaving}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Nhập cấu hình kết nối dưới dạng JSON. Dữ liệu này sẽ được lưu trữ và mã hóa an toàn.
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Configuration (JSON)</label>
            <textarea
              value={configData}
              onChange={(e) => setConfigData(e.target.value)}
              className="w-full h-48 px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
