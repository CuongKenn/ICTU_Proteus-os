// TEMP PREVIEW PAGE — XÓA TRƯỚC KHI COMMIT/PR.
// Trang xem trước Launchpad Pro Max không cần Keycloak:
// seed quyền admin + mock danh sách plugin cài đặt qua axios adapter.
"use client";

import React from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { AppShell } from "@/components/AppShell";
import { LaunchpadClient } from "../launchpad/LaunchpadClient";
import type { Plugin } from "@/types";

const MOCK_PLUGINS: Plugin[] = [
  {
    id: "p1",
    code_name: "hrm",
    display_name: "HRM Nhân sự",
    version: "2.3.0",
    category: "Nhân sự",
    tags: ["cham-cong", "tuyen-dung"],
    is_official: true,
    download_count: 1280,
    status: "ACTIVE",
    roles: [],
    credentials_schema: [],
  },
  {
    id: "p2",
    code_name: "crm",
    display_name: "CRM Bán hàng",
    version: "1.9.1",
    category: "Kinh doanh",
    tags: ["khach-hang", "pipeline"],
    is_official: true,
    download_count: 960,
    status: "ACTIVE",
    roles: [],
    credentials_schema: [],
  },
  {
    id: "p3",
    code_name: "ketoan",
    display_name: "Kế toán FastBooks",
    version: "3.1.2",
    category: "Tài chính",
    tags: ["hoa-don", "thue"],
    is_official: false,
    download_count: 540,
    status: "ACTIVE",
    roles: [],
    credentials_schema: [],
  },
  {
    id: "p4",
    code_name: "kho",
    display_name: "Kho SmartStock",
    version: "1.4.0",
    category: "Vận hành",
    tags: ["ton-kho", "nhap-xuat"],
    is_official: false,
    download_count: 312,
    status: "DISABLED",
    roles: [],
    credentials_schema: [],
  },
  {
    id: "p5",
    code_name: "duan",
    display_name: "Quản lý Dự án",
    version: "2.0.5",
    category: "Vận hành",
    tags: ["kanban", "gantt"],
    is_official: true,
    download_count: 870,
    status: "ACTIVE",
    roles: [],
    credentials_schema: [],
  },
  {
    id: "p6",
    code_name: "tailieu",
    display_name: "Ký số Tài liệu",
    version: "1.2.0",
    category: "Tài chính",
    tags: ["ky-so", "hop-dong"],
    is_official: false,
    download_count: 205,
    status: "ACTIVE",
    roles: [],
    credentials_schema: [],
  },
];

let seeded = false;
function seedPreviewOnce() {
  if (seeded || typeof window === "undefined") return;
  seeded = true;
  useAuthStore.getState().setUser({
    id: "preview-admin",
    email: "preview@proteus.local",
    name: "Preview Admin",
    tenantId: "preview",
    roles: ["tenant_admin"],
  });
  api.interceptors.request.use((config) => {
    if (config.url?.includes("/v1/plugins/installed")) {
      (config as unknown as Record<string, unknown>).adapter = async () => ({
        data: { items: MOCK_PLUGINS, total: MOCK_PLUGINS.length },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      });
    }
    return config;
  });
}

seedPreviewOnce();

export default function PreviewLaunchpadPage() {
  return (
    <AppShell>
      <LaunchpadClient />
    </AppShell>
  );
}
