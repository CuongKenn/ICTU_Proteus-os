// Finance Module — meta cho gateway (catalog + nav). Không chứa logic.
export interface PluginRoute {
  path: string; // '' = index, còn lại 'transactions' | 'invoices' | 'expenses'
  label: string;
}

export const financeMeta = {
  code: 'finance-module',
  displayName: 'Tài chính Kế toán',
  description:
    'Quản lý tài chính kế toán: theo dõi thu chi, xử lý hóa đơn, duyệt đề xuất chi, ngân sách.',
  routes: [
    { path: '', label: 'Tổng quan' },
    { path: 'transactions', label: 'Giao dịch' },
    { path: 'invoices', label: 'Hóa đơn' },
    { path: 'expenses', label: 'Đề xuất chi' },
  ] as PluginRoute[],
};
