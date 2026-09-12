// Meeting Module — meta cho gateway (catalog + nav). Không chứa logic.
export interface PluginRoute {
  path: string; // '' = index, còn lại 'rooms' | 'bookings' | 'actions'
  label: string;
}

export const meetingMeta = {
  code: 'meeting-module',
  displayName: 'Quản lý Cuộc họp & Phòng họp',
  description:
    'Đặt phòng họp, gửi thư mời, ghi biên bản và theo dõi việc cần làm sau họp.',
  routes: [
    { path: '', label: 'Tổng quan' },
    { path: 'rooms', label: 'Phòng họp' },
    { path: 'bookings', label: 'Đặt phòng' },
    { path: 'actions', label: 'Việc cần làm' },
  ] as PluginRoute[],
};
