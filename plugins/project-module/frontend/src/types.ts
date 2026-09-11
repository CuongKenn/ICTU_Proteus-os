// Project Module — types map 1-1 với migrations/V1.0.0__initial.sql
// (project_projects, project_milestones, project_tasks,
//  project_task_comments, project_time_logs, project_members).

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Project {
  id: string;
  code: string;
  name: string;
  manager_id: string | null; // UUID hr_employees ở live
  manager_name: string; // tên hiển thị (demo + UI)
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  budget: number; // VND
  status: ProjectStatus;
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  due_date: string; // YYYY-MM-DD
  completion_pct: number; // 0-100
}

export interface ProjectTask {
  id: string;
  project_id: string;
  milestone_id: string | null;
  title: string;
  description: string;
  assignee_id: string | null; // UUID hr_employees ở live
  assignee_name: string; // tên hiển thị (demo + UI)
  due_date: string; // YYYY-MM-DD
  priority: TaskPriority;
  status: TaskStatus;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string; // tên hiển thị (demo + UI)
  content: string;
  created_at: string; // ISO
}

export interface TimeLog {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string; // tên hiển thị (demo + UI)
  log_date: string; // YYYY-MM-DD
  hours: number;
  notes: string;
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNING: 'Chuẩn bị',
  ACTIVE: 'Đang triển khai',
  ON_HOLD: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'Cần làm',
  IN_PROGRESS: 'Đang làm',
  REVIEW: 'Chờ duyệt',
  DONE: 'Hoàn thành',
};

export const TASK_STAGES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

export function formatVND(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}
