// Asset Module — meta cho gateway (catalog + nav). Không chứa logic.
export interface PluginRoute {
  path: string; // '' = index, còn lại 'assets' | 'maintenance' | 'disposals'
  label: string;
}

export const assetMeta = {
  code: 'asset-module',
  displayName: 'Quản lý Tài sản Thiết bị',
  description:
    'Quản lý tài sản cố định: danh mục, cấp phát, bảo trì, khấu hao, thanh lý.',
  routes: [
    { path: '', label: 'Tổng quan' },
    { path: 'assets', label: 'Tài sản' },
    { path: 'maintenance', label: 'Bảo trì' },
    { path: 'disposals', label: 'Thanh lý' },
  ] as PluginRoute[],
};
