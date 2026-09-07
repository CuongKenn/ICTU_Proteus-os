// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PluginInfo } from "@/types";

export const MOCK_PLUGINS: PluginInfo[] = [
  {
    id: "hr-module",
    code_name: "hr-module",
    display_name: "Quản lý Nhân sự Pro",
    description: "Quản lý nhân sự toàn diện: chấm công, nghỉ phép, lương.",
    version: "2.1.0",
    author: "ICTU Team",
    is_official: true,
    download_count: 120,
    category: "HR",
    tags: ["hr", "payroll"],
    credentials_schema: [],
  },
  {
    id: "crm-module",
    code_name: "crm-module",
    display_name: "CRM Tối giản",
    description: "Quản lý khách hàng, cơ hội bán hàng và ticket hỗ trợ.",
    version: "1.0.0",
    author: "ICTU Team",
    is_official: true,
    download_count: 85,
    category: "CRM",
    tags: ["crm", "sales"],
    credentials_schema: [],
  },
];
