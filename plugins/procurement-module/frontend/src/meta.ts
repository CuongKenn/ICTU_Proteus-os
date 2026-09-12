// Procurement Module — meta cho gateway (catalog + nav). Không chứa logic.
export interface PluginRoute {
  path: string; // '' = index, còn lại 'requests' | 'vendors' | 'contracts'
  label: string;
}

export const procurementMeta = {
  code: 'procurement-module',
  displayName: 'Procurement & Contract Management',
  description:
    'Quản lý mua sắm: đề xuất mua hàng, nhà cung cấp, hợp đồng, đơn đặt hàng (PO).',
  routes: [
    { path: '', label: 'Tổng quan' },
    { path: 'requests', label: 'Đề xuất' },
    { path: 'vendors', label: 'Nhà cung cấp' },
    { path: 'contracts', label: 'Hợp đồng' },
  ] as PluginRoute[],
};
