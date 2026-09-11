// HR Core — meta cho gateway (catalog + nav). Không chứa logic.
export interface PluginRoute {
  path: string; // '' = index, còn lại 'employees' | 'leaves' | 'departments'
  label: string;
}

export const hrMeta = {
  code: 'hr-module',
  displayName: 'HR Core',
  description:
    'Quản lý nhân sự: hồ sơ nhân viên, nghỉ phép, phòng ban, chấm công.',
  routes: [
    { path: '', label: 'Tổng quan' },
    { path: 'employees', label: 'Nhân viên' },
    { path: 'leaves', label: 'Nghỉ phép' },
    { path: 'departments', label: 'Phòng ban' },
    { path: 'recruitment', label: 'Tuyển dụng' },
  ] as PluginRoute[],
};
