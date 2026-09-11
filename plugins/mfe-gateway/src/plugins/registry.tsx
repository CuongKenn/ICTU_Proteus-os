// mfe-gateway — HOST/SHELL. Không chứa business UI.
// Source of truth của từng plugin nằm ở plugins/<code>/frontend/src,
// được sync vào src/_plugins/<code> bởi scripts/sync-plugins.mjs
// (chạy ở prebuild/predev + trong Dockerfile).
import { AssetModuleApp } from '../_plugins/asset-module/App';
import { assetMeta } from '../_plugins/asset-module/meta';
import { CrmModuleApp } from '../_plugins/crm-module/App';
import { crmMeta } from '../_plugins/crm-module/meta';

export interface PluginEntry {
  code: string;
  displayName: string;
  description: string;
  ready: boolean;
  render: (props: { subPath: string; navigate: (sub: string) => void }) => JSX.Element;
}

// 7 plugin còn lại chưa có frontend/ → ready: false, hiển thị "Đang phát triển".
const comingSoon: Array<Omit<PluginEntry, 'render'>> = [
  { code: 'hr-module', displayName: 'HR Core', description: 'Hồ sơ nhân viên, nghỉ phép, chấm công. UI: ui/appsmith_app.json', ready: false },
  { code: 'finance-module', displayName: 'Tài chính Kế toán', description: 'Tài khoản, giao dịch, hóa đơn. UI: ui/appsmith_app.json', ready: false },
  { code: 'project-module', displayName: 'Quản lý Dự án Công việc', description: 'Dự án, milestones. UI: ui/appsmith_app.json', ready: false },
  { code: 'document-module', displayName: 'Document Management', description: 'Văn bản đến/đi. UI: ui/appsmith_app.json', ready: false },
  { code: 'meeting-module', displayName: 'Quản lý Cuộc họp & Phòng họp', description: 'Phòng họp, booking. UI: ui/appsmith_app.json', ready: false },
  { code: 'procurement-module', displayName: 'Procurement & Contracts', description: 'Mua sắm, NCC. UI: ui/appsmith_app.json', ready: false },
  { code: 'it-helpdesk-module', displayName: 'IT Service Desk', description: 'Ticket nội bộ, SLA. UI: ui/appsmith_app.json', ready: false },
];

export const registry: PluginEntry[] = [
  {
    code: assetMeta.code,
    displayName: assetMeta.displayName,
    description: assetMeta.description,
    ready: true,
    render: (p) => <AssetModuleApp {...p} />,
  },
  {
    code: crmMeta.code,
    displayName: crmMeta.displayName,
    description: crmMeta.description,
    ready: true,
    render: (p) => <CrmModuleApp {...p} />,
  },
  ...comingSoon.map((c) => ({ ...c, render: () => <></> as unknown as JSX.Element })),
];
