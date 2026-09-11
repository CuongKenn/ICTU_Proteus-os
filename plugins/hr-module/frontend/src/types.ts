// HR Core — types map 1-1 với db/seed_data.sql
// (+ migrations/V1.1.0__add_emergency_contact.sql: hr_employees.emergency_contact).
// tenant_id do server tự inject từ session — client KHÔNG BAO GIỜ gửi.

export interface Department {
  id: string;
  code: string;
  name: string;
}

export type EmployeeStatus = 'active' | 'inactive';

export interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  department_id: string;
  position: string;
  hire_date: string; // YYYY-MM-DD
  status: EmployeeStatus;
  annual_leave_balance: number; // ngày phép còn lại
  emergency_contact?: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  year: number;
  remaining_days: number;
}

// DB default là 'PENDING_APPROVAL' (workflow wf_leave_request); UI gom
// 'PENDING' + 'PENDING_APPROVAL' thành "Chờ duyệt" (xem isPendingLeave).
export type LeaveStatus = 'PENDING' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  duration_days: number;
  status: LeaveStatus;
  created_at: string; // ISO
}

export interface AttendanceLog {
  id: string;
  employee_id: string;
  log_time: string; // ISO
}

export interface PayrollRecord {
  id: string;
  employee_id: string;
  amount: number; // VND
}

export interface OnboardingTask {
  id: string;
  employee_id: string;
  task_name: string;
  is_completed: boolean;
}

export const EMPLOYEE_STATUS_LABEL: Record<EmployeeStatus, string> = {
  active: 'Đang làm việc',
  inactive: 'Nghỉ việc',
};

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING: 'Chờ duyệt',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

export const LEAVE_STATUS_COLOR: Record<LeaveStatus, string> = {
  PENDING: '#f59e0b',
  PENDING_APPROVAL: '#f59e0b',
  APPROVED: '#22c55e',
  REJECTED: '#ef4444',
};

export function isPendingLeave(s: LeaveStatus): boolean {
  return s === 'PENDING' || s === 'PENDING_APPROVAL';
}

export function formatVND(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}

/** Số ngày nghỉ tính cả 2 đầu (start..end). Trả 0 nếu khoảng không hợp lệ. */
export function leaveDays(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / 86400000) + 1;
}
