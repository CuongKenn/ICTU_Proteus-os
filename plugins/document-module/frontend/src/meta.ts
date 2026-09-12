// Document Module — meta cho gateway (catalog + nav). Không chứa logic.
export interface PluginRoute {
  path: string; // '' = index, còn lại 'incoming' | 'outgoing' | 'approvals'
  label: string;
}

export const documentMeta = {
  code: 'document-module',
  displayName: 'Document Management System',
  description:
    'Quản lý văn bản công văn: tiếp nhận văn bản đến, ban hành văn bản đi, luồng ký duyệt.',
  routes: [
    { path: '', label: 'Tổng quan' },
    { path: 'incoming', label: 'Văn bản đến' },
    { path: 'outgoing', label: 'Văn bản đi' },
    { path: 'approvals', label: 'Phê duyệt' },
  ] as PluginRoute[],
};
