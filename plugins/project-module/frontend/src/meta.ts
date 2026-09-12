// Project Module — meta cho gateway (catalog + nav). Không chứa logic.
export interface PluginRoute {
  path: string; // '' = index, còn lại 'projects' | 'tasks' | 'milestones'
  label: string;
}

export const projectMeta = {
  code: 'project-module',
  displayName: 'Quản lý Dự án Công việc',
  description:
    'Quản lý dự án, theo dõi tiến độ, phân công công việc, milestone và KPIs.',
  routes: [
    { path: '', label: 'Tổng quan' },
    { path: 'projects', label: 'Dự án' },
    { path: 'tasks', label: 'Công việc' },
    { path: 'milestones', label: 'Cột mốc' },
  ] as PluginRoute[],
};
