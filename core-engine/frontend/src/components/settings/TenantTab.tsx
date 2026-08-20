// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Building2, Save, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";

interface TenantData {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
}

export const TenantTab: React.FC = () => {
  const { data: session } = useSession();
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const res = await fetch("/api/v1/tenants/me", {
          headers: {
            Authorization: `Bearer ${(session as any)?.accessToken}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch tenant");
        const data = await res.json();
        setTenant(data);
        setName(data.name);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        setError("Không thể tải thông tin tổ chức.");
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchTenant();
    }
  }, [session]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/v1/tenants/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to update tenant");
      const data = await res.json();
      setTenant(data);
      setSuccess("Cập nhật thông tin thành công!");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Có lỗi xảy ra khi lưu thông tin.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-text-secondary mt-4">Đang tải thông tin...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-bg-surface rounded-xl border border-border border-dashed">
        <p className="text-error">Không tìm thấy thông tin tổ chức.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Thông tin tổ chức (Tenant)</h2>
        <p className="text-text-secondary text-sm mt-1">
          Quản lý thông tin và cài đặt chung của tổ chức của bạn.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-error/10 text-error rounded-lg border border-error/20">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-success/10 text-success rounded-lg border border-success/20">
          {success}
        </div>
      )}

      <div className="flex items-center gap-6 pb-8 border-b border-border">
        <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30 text-primary shrink-0 shadow-sm">
          <Building2 className="w-10 h-10" />
        </div>
        <div>
          <h3 className="text-2xl font-semibold text-text-primary">{tenant.name}</h3>
          <p className="text-text-secondary mt-1">Gói dịch vụ: <span className="uppercase font-medium text-primary">{tenant.plan}</span></p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-text-primary">Tên tổ chức</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        
        <div className="grid gap-2">
          <label className="text-sm font-medium text-text-primary">Slug (Định danh URL)</label>
          <input
            type="text"
            readOnly
            value={tenant.slug}
            className="w-full bg-bg-surface/50 border border-border rounded-lg px-4 py-2 text-text-primary cursor-not-allowed opacity-70"
          />
          <p className="text-xs text-text-secondary mt-1">Slug là cố định và không thể thay đổi sau khi tạo.</p>
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving || name === tenant.name}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Lưu thay đổi
          </Button>
        </div>
      </div>
    </div>
  );
};
