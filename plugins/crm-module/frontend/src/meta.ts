// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
export const crmMeta = {
  code: 'crm-module',
  displayName: 'Quản lý Khách hàng - CRM',
  description:
    'Vòng đời khách hàng: lead → cơ hội → hợp đồng → ticket hỗ trợ & SLA.',
  routes: [
    { path: '', label: 'Tổng quan' },
    { path: 'leads', label: 'Leads' },
    { path: 'opportunities', label: 'Cơ hội' },
    { path: 'customers', label: 'Khách hàng' },
    { path: 'tickets', label: 'Tickets' },
  ] as Array<{ path: string; label: string }>,
};
