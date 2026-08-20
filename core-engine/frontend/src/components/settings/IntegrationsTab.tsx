// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Plug, Plus, Loader2, Link2, CheckCircle2, XCircle, Save } from "lucide-react";
import { useSession } from "next-auth/react";

interface IntegrationData {
  id: string;
  provider: string;
  config: Record<string, any>;
  is_active: boolean;
}

export const IntegrationsTab: React.FC = () => {
  const { data: session } = useSession();
  const [integrations, setIntegrations] = useState<IntegrationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newProvider, setNewProvider] = useState("");
  const [newConfig, setNewConfig] = useState("");

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const res = await fetch("/api/v1/tenants/me/integrations", {
          headers: {
            Authorization: `Bearer ${(session as any)?.accessToken}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch integrations");
        const data = await res.json();
        setIntegrations(data);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        setError("Không thể tải danh sách kết nối.");
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchIntegrations();
    }
  }, [session]);

  const handleAddIntegration = async () => {
    try {
      setError(null);
      let parsedConfig = {};
      try {
        parsedConfig = JSON.parse(newConfig);
      } catch (e) {
        setError("Cấu hình phải là định dạng JSON hợp lệ.");
        return;
      }

      const res = await fetch("/api/v1/tenants/me/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
        body: JSON.stringify({
          provider: newProvider,
          config: parsedConfig,
        }),
      });

      if (!res.ok) throw new Error("Failed to add integration");
      const data = await res.json();
      setIntegrations([...integrations, data]);
      setIsAdding(false);
      setNewProvider("");
      setNewConfig("");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Có lỗi xảy ra khi thêm kết nối.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-text-secondary mt-4">Đang tải cấu hình kết nối...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Kết nối & Tích hợp (Integrations)</h2>
          <p className="text-text-secondary text-sm mt-1">
            Quản lý API keys, webhook URLs và các hệ thống bên thứ ba.
          </p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} variant="primary">
          {isAdding ? <XCircle className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {isAdding ? "Hủy" : "Thêm Kết Nối"}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-error/10 text-error rounded-lg border border-error/20">
          {error}
        </div>
      )}

      {isAdding && (
        <div className="p-6 bg-bg-surface/50 border border-border rounded-xl space-y-4">
          <h3 className="text-lg font-medium text-text-primary">Thêm Kết Nối Mới</h3>
          
          <div className="grid gap-2">
            <label className="text-sm font-medium text-text-primary">Tên Provider (VD: github, slack, aws)</label>
            <input
              type="text"
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value)}
              placeholder="github"
              className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-text-primary">Cấu hình (JSON)</label>
            <textarea
              value={newConfig}
              onChange={(e) => setNewConfig(e.target.value)}
              placeholder='{"apiKey": "xxx", "webhook": "yyy"}'
              rows={4}
              className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-primary transition-colors font-mono text-sm"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleAddIntegration} disabled={!newProvider || !newConfig}>
              <Save className="w-4 h-4 mr-2" /> Lưu Kết Nối
            </Button>
          </div>
        </div>
      )}

      {integrations.length === 0 && !isAdding ? (
        <div className="flex flex-col items-center justify-center h-48 bg-bg-surface/30 rounded-xl border border-border border-dashed">
          <Plug className="w-12 h-12 text-text-muted mb-3" />
          <p className="text-text-secondary">Chưa có kết nối nào được cấu hình.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {integrations.map((integration) => (
            <div key={integration.id} className="p-5 bg-bg-surface border border-border rounded-xl shadow-sm hover:border-primary/50 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-text-primary capitalize">{integration.provider}</span>
                  </div>
                  {integration.is_active ? (
                    <span className="flex items-center text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Hoạt động
                    </span>
                  ) : (
                    <span className="flex items-center text-xs font-medium text-error bg-error/10 px-2 py-1 rounded-full">
                      <XCircle className="w-3 h-3 mr-1" /> Vô hiệu
                    </span>
                  )}
                </div>
                <div className="mt-2 bg-bg-base/50 p-3 rounded-lg overflow-x-auto">
                  <pre className="text-xs text-text-secondary font-mono">
                    {JSON.stringify(integration.config, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
