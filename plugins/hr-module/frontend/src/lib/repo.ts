// HR Core — DATA LAYER.
// Hai chế độ sau cùng 1 interface async HrStore:
// - DEMO: createMockRepo (seed + localStorage, offline, không cần login).
// - LIVE: API thật (records CRUD + dispatcher → n8n), cần login ở Launchpad.
// getStore() tự dò: gọi thử API, rớt (401/offline/chưa cài) → DEMO + lý do.
//
// LƯU Ý dispatcher contract (giữ nguyên webhook path): mutation tạo đơn nghỉ
// đi qua POST /v1/plugins/hr-module/actions/wf_leave_request với body
// { payload: {...} } — browser chỉ gọi BFF /api/proxy, KHÔNG fetch trực tiếp
// n8n/backend. Client KHÔNG BAO GIỜ gửi tenant_id — server tự inject.
import type {
  AttendanceLog,
  Department,
  Employee,
  LeaveBalance,
  LeaveRequest,
  LeaveStatus,
  OnboardingTask,
  PayrollRecord,
} from '../types';
import { isPendingLeave } from '../types';
import {
  seedAttendance,
  seedDepartments,
  seedEmployees,
  seedLeaveBalances,
  seedLeaveRequests,
  seedOnboarding,
  seedPayroll,
} from '../data/seed';

const LS_KEY = 'proteus:hr-module:v1';

interface Persisted {
  departments: Department[];
  employees: Employee[];
  balances: LeaveBalance[];
  leaves: LeaveRequest[];
  attendance: AttendanceLog[];
  payroll: PayrollRecord[];
  onboarding: OnboardingTask[];
}

function load(): Persisted {
  const fallback: Persisted = {
    departments: seedDepartments,
    employees: seedEmployees,
    balances: seedLeaveBalances,
    leaves: seedLeaveRequests,
    attendance: seedAttendance,
    payroll: seedPayroll,
    onboarding: seedOnboarding,
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      departments: parsed.departments ?? fallback.departments,
      employees: parsed.employees ?? fallback.employees,
      balances: parsed.balances ?? fallback.balances,
      leaves: parsed.leaves ?? fallback.leaves,
      attendance: parsed.attendance ?? fallback.attendance,
      payroll: parsed.payroll ?? fallback.payroll,
      onboarding: parsed.onboarding ?? fallback.onboarding,
    };
  } catch {
    return fallback;
  }
}

function save(s: Persisted) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota */
  }
}

export function uid(): string {
  return 'xxxxxxxx-xxxx-4xxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

export interface HrRepo {
  listDepartments(): Department[];
  createDepartment(input: Omit<Department, 'id'>): Department;
  removeDepartment(id: string): void;
  listEmployees(): Employee[];
  createEmployee(input: Omit<Employee, 'id'>): Employee;
  updateEmployee(id: string, patch: Partial<Employee>): Employee;
  removeEmployee(id: string): void;
  listLeaveBalances(): LeaveBalance[];
  listLeaveRequests(): LeaveRequest[];
  createLeaveRequest(input: {
    employee_id: string;
    start_date: string;
    end_date: string;
    duration_days: number;
  }): LeaveRequest;
  reviewLeaveRequest(id: string, status: 'APPROVED' | 'REJECTED'): void;
  listAttendance(): AttendanceLog[];
  listPayroll(): PayrollRecord[];
  listOnboarding(employee_id?: string): OnboardingTask[];
  reset(): void;
}

export function createMockRepo(): HrRepo {
  return {
    listDepartments: () => load().departments,
    createDepartment(input) {
      const s = load();
      if (s.departments.some((d) => d.code === input.code)) {
        throw new Error(`Mã phòng ban ${input.code} đã tồn tại`);
      }
      const row = { ...input, id: uid() };
      s.departments = [...s.departments, row];
      save(s);
      return row;
    },
    removeDepartment(id) {
      const s = load();
      if (s.employees.some((e) => e.department_id === id)) {
        throw new Error('Phòng ban còn nhân viên — hãy chuyển nhân viên đi trước');
      }
      s.departments = s.departments.filter((d) => d.id !== id);
      save(s);
    },
    listEmployees: () => load().employees,
    createEmployee(input) {
      const s = load();
      if (s.employees.some((e) => e.employee_code === input.employee_code)) {
        throw new Error(`Mã nhân viên ${input.employee_code} đã tồn tại`);
      }
      const row = { ...input, id: uid() };
      s.employees = [row, ...s.employees];
      save(s);
      return row;
    },
    updateEmployee(id, patch) {
      const s = load();
      const emp = s.employees.find((e) => e.id === id);
      if (!emp) throw new Error('Không tìm thấy nhân viên');
      Object.assign(emp, patch);
      save(s);
      return emp;
    },
    removeEmployee(id) {
      const s = load();
      s.employees = s.employees.filter((e) => e.id !== id);
      save(s);
    },
    listLeaveBalances: () => load().balances,
    listLeaveRequests: () => load().leaves,
    createLeaveRequest(input) {
      const s = load();
      const emp = s.employees.find((e) => e.id === input.employee_id);
      if (!emp) throw new Error('Không tìm thấy nhân viên');
      if (input.duration_days <= 0) throw new Error('Khoảng ngày nghỉ không hợp lệ');
      const row: LeaveRequest = {
        ...input,
        id: uid(),
        status: 'PENDING',
        created_at: new Date().toISOString(),
      };
      s.leaves = [row, ...s.leaves];
      save(s);
      return row;
    },
    reviewLeaveRequest(id, status) {
      const s = load();
      const req = s.leaves.find((l) => l.id === id);
      if (!req) throw new Error('Không tìm thấy đơn nghỉ');
      if (!isPendingLeave(req.status)) throw new Error('Đơn đã được xử lý trước đó');
      req.status = status;
      if (status === 'APPROVED') {
        const emp = s.employees.find((e) => e.id === req.employee_id);
        if (emp) {
          emp.annual_leave_balance = Math.max(0, emp.annual_leave_balance - req.duration_days);
        }
        const bal = s.balances.find((b) => b.employee_id === req.employee_id);
        if (bal) bal.remaining_days = Math.max(0, bal.remaining_days - req.duration_days);
      }
      save(s);
    },
    listAttendance: () => load().attendance,
    listPayroll: () => load().payroll,
    listOnboarding: (employee_id) => {
      const all = load().onboarding;
      return employee_id ? all.filter((t) => t.employee_id === employee_id) : all;
    },
    reset() {
      localStorage.removeItem(LS_KEY);
    },
  };
}

// ─── Async Store (DEMO + LIVE chung interface) ──────────────
import { ApiError, createBffClient, type BffClient } from './api';

export type StoreMode = 'live' | 'demo';
export type DemoReason =
  | 'unauthenticated' // 401: chưa login ở Launchpad
  | 'not-installed' // plugin chưa ACTIVE / bảng chưa có
  | 'offline'; // không tới được BFF

export interface HrStore {
  listDepartments(): Promise<Department[]>;
  createDepartment(input: Omit<Department, 'id'>): Promise<Department>;
  removeDepartment(id: string): Promise<void>;
  listEmployees(): Promise<Employee[]>;
  createEmployee(input: Omit<Employee, 'id'>): Promise<Employee>;
  updateEmployee(id: string, patch: Partial<Employee>): Promise<Employee>;
  removeEmployee(id: string): Promise<void>;
  listLeaveBalances(): Promise<LeaveBalance[]>;
  listLeaveRequests(): Promise<LeaveRequest[]>;
  createLeaveRequest(input: {
    employee_id: string;
    start_date: string;
    end_date: string;
    duration_days: number;
  }): Promise<LeaveRequest>;
  reviewLeaveRequest(id: string, status: 'APPROVED' | 'REJECTED'): Promise<void>;
  listAttendance(): Promise<AttendanceLog[]>;
  listPayroll(): Promise<PayrollRecord[]>;
  listOnboarding(employee_id?: string): Promise<OnboardingTask[]>;
  reset(): Promise<void>;
}

const R = '/v1/plugins/hr-module/records';
const A = '/v1/plugins/hr-module/actions';

function toEmployee(r: Record<string, unknown>): Employee {
  return {
    id: String(r.id ?? ''),
    employee_code: String(r.employee_code ?? ''),
    full_name: String(r.full_name ?? ''),
    email: String(r.email ?? ''),
    department_id: String(r.department_id ?? ''),
    position: String(r.position ?? ''),
    hire_date: String(r.hire_date ?? '').slice(0, 10),
    status: r.status === 'inactive' ? 'inactive' : 'active',
    annual_leave_balance: Number(r.annual_leave_balance ?? 0),
    emergency_contact: r.emergency_contact ? String(r.emergency_contact) : undefined,
  };
}

function toLeave(r: Record<string, unknown>): LeaveRequest {
  const raw = String(r.status ?? 'PENDING');
  const status: LeaveStatus =
    raw === 'APPROVED' || raw === 'REJECTED' || raw === 'PENDING_APPROVAL'
      ? raw
      : 'PENDING';
  return {
    id: String(r.id ?? ''),
    employee_id: String(r.employee_id ?? ''),
    start_date: String(r.start_date ?? '').slice(0, 10),
    end_date: String(r.end_date ?? '').slice(0, 10),
    duration_days: Number(r.duration_days ?? 0),
    status,
    created_at: String(r.created_at ?? ''),
  };
}

/** Demo store: bọc mock sync thành async (giữ nguyên localStorage). */
export function createDemoStore(): HrStore {
  const m = createMockRepo();
  return {
    async listDepartments() { return m.listDepartments(); },
    async createDepartment(i) { return m.createDepartment(i); },
    async removeDepartment(id) { m.removeDepartment(id); },
    async listEmployees() { return m.listEmployees(); },
    async createEmployee(i) { return m.createEmployee(i); },
    async updateEmployee(id, p) { return m.updateEmployee(id, p); },
    async removeEmployee(id) { m.removeEmployee(id); },
    async listLeaveBalances() { return m.listLeaveBalances(); },
    async listLeaveRequests() { return m.listLeaveRequests(); },
    async createLeaveRequest(i) { return m.createLeaveRequest(i); },
    async reviewLeaveRequest(id, s) { m.reviewLeaveRequest(id, s); },
    async listAttendance() { return m.listAttendance(); },
    async listPayroll() { return m.listPayroll(); },
    async listOnboarding(e) { return m.listOnboarding(e); },
    async reset() { m.reset(); },
  };
}

/** Live store: records CRUD + dispatcher → n8n webhook. Không gửi tenant_id. */
export function createLiveStore(client: BffClient): HrStore {
  const rows = async <T>(table: string): Promise<T[]> => {
    const res = await client.get<{ rows: T[] }>(`${R}/${table}?limit=100`);
    return res.rows ?? [];
  };
  return {
    async listDepartments() {
      return rows<Record<string, unknown>>('hr_departments').then((ds) =>
        ds.map((d) => ({ id: String(d.id), code: String(d.code ?? ''), name: String(d.name ?? '') })),
      );
    },
    async createDepartment(i) {
      const row = await client.post<Record<string, unknown>>(`${R}/hr_departments`, i);
      return { id: String(row.id), code: String(row.code ?? i.code), name: String(row.name ?? i.name) };
    },
    async removeDepartment(id) {
      await client.del(`${R}/hr_departments/${id}`);
    },
    async listEmployees() {
      return (await rows<Record<string, unknown>>('hr_employees')).map(toEmployee);
    },
    async createEmployee(i) {
      return toEmployee(await client.post(`${R}/hr_employees`, i));
    },
    async updateEmployee(id, p) {
      return toEmployee(await client.patch(`${R}/hr_employees/${id}`, p));
    },
    async removeEmployee(id) {
      await client.del(`${R}/hr_employees/${id}`);
    },
    async listLeaveBalances() {
      return rows<LeaveBalance>('hr_leave_balances');
    },
    async listLeaveRequests() {
      return (await rows<Record<string, unknown>>('hr_leave_requests')).map(toLeave);
    },
    // Tạo đơn nghỉ đi qua workflow wf_leave_request (check số dư → nhắn manager).
    async createLeaveRequest(input) {
      const res = await client.post<Record<string, unknown>>(`${A}/wf_leave_request`, {
        payload: { ...input },
      });
      if (res && res.id) return toLeave(res);
      // Dispatcher 202 xử lý ngầm — đọc lại để lấy dòng workflow vừa tạo.
      const all = await this.listLeaveRequests();
      const found = all.find(
        (l) =>
          l.employee_id === input.employee_id &&
          l.start_date === input.start_date &&
          l.end_date === input.end_date,
      );
      if (found) return found;
      return { ...input, id: `pending-${Date.now()}`, status: 'PENDING', created_at: new Date().toISOString() };
    },
    async reviewLeaveRequest(id, status) {
      await client.patch(`${R}/hr_leave_requests/${id}`, { status });
    },
    async listAttendance() {
      return rows<AttendanceLog>('hr_attendance_logs');
    },
    async listPayroll() {
      return rows<PayrollRecord>('hr_payroll_records');
    },
    async listOnboarding(employee_id) {
      const all = await rows<OnboardingTask>('hr_onboarding_tasks');
      return employee_id ? all.filter((t) => t.employee_id === employee_id) : all;
    },
    async reset() { /* live: không reset DB từ UI */ },
  };
}

export interface ResolvedStore {
  mode: StoreMode;
  store: HrStore;
  reason?: DemoReason;
  message?: string;
}

let cached: Promise<ResolvedStore> | null = null;

/** Dò API thật, rớt → demo + lý do để UI hiển thị banner trung thực. */
export function getStore(): Promise<ResolvedStore> {
  if (!cached) {
    cached = (async () => {
      const client = createBffClient();
      try {
        await client.get(`${R}/hr_employees?limit=1`);
        return { mode: 'live' as const, store: createLiveStore(client) };
      } catch (e) {
        const st = e instanceof ApiError ? e.status : 0;
        const detail = e instanceof ApiError ? e.detail : String(e);
        const reason: DemoReason =
          st === 401 ? 'unauthenticated'
          : st === 400 || st === 404 ? 'not-installed'
          : 'offline';
        return { mode: 'demo' as const, store: createDemoStore(), reason, message: detail };
      }
    })();
  }
  return cached;
}

export function resetStoreCache() {
  cached = null;
}
