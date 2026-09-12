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
  Application,
  AppStage,
  AttendanceLog,
  Department,
  Employee,
  Interview,
  JobPosting,
  LeaveBalance,
  LeaveRequest,
  LeaveStatus,
  Offer,
  OnboardingTask,
  PayrollRecord,
} from '../types';
import { isPendingLeave } from '../types';
import {
  seedApplications,
  seedAttendance,
  seedDepartments,
  seedEmployees,
  seedInterviews,
  seedLeaveBalances,
  seedLeaveRequests,
  seedOffers,
  seedOnboarding,
  seedPayroll,
  seedPostings,
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
  postings: JobPosting[];
  applications: Application[];
  interviews: Interview[];
  offers: Offer[];
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
    postings: seedPostings,
    applications: seedApplications,
    interviews: seedInterviews,
    offers: seedOffers,
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
      postings: parsed.postings ?? fallback.postings,
      applications: parsed.applications ?? fallback.applications,
      interviews: parsed.interviews ?? fallback.interviews,
      offers: parsed.offers ?? fallback.offers,
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
  listPostings(): JobPosting[];
  createPosting(input: Omit<JobPosting, 'id'>): JobPosting;
  listApplications(): Application[];
  createApplication(input: Omit<Application, 'id' | 'stage' | 'score' | 'screening_notes'>): Application;
  moveApplication(id: string, stage: AppStage): void;
  setApplicationScore(id: string, score: number, notes: string): void;
  listInterviews(): Interview[];
  scheduleInterview(input: Omit<Interview, 'id' | 'result'>): Interview;
  setInterviewResult(id: string, result: 'PASS' | 'FAIL', notes: string): void;
  listOffers(): Offer[];
  createOffer(input: Omit<Offer, 'id' | 'status'>): Offer;
  hireFromOffer(offer_id: string): Employee;
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
    listPostings: () => load().postings,
    createPosting(input) {
      const s = load();
      const row = { ...input, id: uid() };
      s.postings = [row, ...s.postings];
      save(s);
      return row;
    },
    listApplications: () => load().applications,
    createApplication(input) {
      const s = load();
      const row: Application = { ...input, id: uid(), stage: 'NEW', score: null, screening_notes: '' };
      s.applications = [row, ...s.applications];
      save(s);
      return row;
    },
    moveApplication(id, stage) {
      const s = load();
      const a = s.applications.find((x) => x.id === id);
      if (a) { a.stage = stage; save(s); }
    },
    setApplicationScore(id, score, notes) {
      const s = load();
      const a = s.applications.find((x) => x.id === id);
      if (a) { a.score = score; a.screening_notes = notes; save(s); }
    },
    listInterviews: () => load().interviews,
    scheduleInterview(input) {
      const s = load();
      const row: Interview = { ...input, id: uid(), result: 'PENDING' };
      s.interviews = [row, ...s.interviews];
      save(s);
      return row;
    },
    setInterviewResult(id, result, notes) {
      const s = load();
      const it = s.interviews.find((x) => x.id === id);
      if (it) { it.result = result; it.notes = notes; save(s); }
    },
    listOffers: () => load().offers,
    createOffer(input) {
      const s = load();
      const row: Offer = { ...input, id: uid(), status: 'DRAFT' };
      s.offers = [row, ...s.offers];
      save(s);
      return row;
    },
    hireFromOffer(offer_id) {
      const s = load();
      const offer = s.offers.find((o) => o.id === offer_id);
      if (!offer) throw new Error('Không tìm thấy offer');
      const app = s.applications.find((a) => a.id === offer.application_id);
      if (!app) throw new Error('Không tìm thấy hồ sơ');
      const code = `NV${String(s.employees.length + 1).padStart(3, '0')}`;
      const emp: Employee = {
        id: uid(), employee_code: code, full_name: app.full_name, email: app.email,
        department_id: '', position: '', hire_date: new Date().toISOString().slice(0, 10),
        status: 'active', annual_leave_balance: 12,
      };
      s.employees = [emp, ...s.employees];
      app.stage = 'HIRED';
      offer.status = 'ACCEPTED';
      save(s);
      return emp;
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
  listPostings(): Promise<JobPosting[]>;
  createPosting(input: Omit<JobPosting, 'id'>): Promise<JobPosting>;
  listApplications(): Promise<Application[]>;
  createApplication(input: Omit<Application, 'id' | 'stage' | 'score' | 'screening_notes'>): Promise<Application>;
  moveApplication(id: string, stage: AppStage): Promise<void>;
  setApplicationScore(id: string, score: number, notes: string): Promise<void>;
  screenApplication(id: string): Promise<{ score: number | null }>;
  listInterviews(): Promise<Interview[]>;
  scheduleInterview(input: Omit<Interview, 'id' | 'result'>): Promise<Interview>;
  setInterviewResult(id: string, result: 'PASS' | 'FAIL', notes: string): Promise<void>;
  listOffers(): Promise<Offer[]>;
  createOffer(input: Omit<Offer, 'id' | 'status'>): Promise<Offer>;
  hireFromOffer(offer_id: string): Promise<Employee>;
  reset(): Promise<void>;
}

function toPosting(r: Record<string, unknown>): JobPosting {
  return {
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    department_id: String(r.department_id ?? ''),
    employment_type: String(r.employment_type ?? 'FULLTIME'),
    location: String(r.location ?? ''),
    salary_min: Number(r.salary_min ?? 0),
    salary_max: Number(r.salary_max ?? 0),
    description: String(r.description ?? ''),
    requirements: String(r.requirements ?? ''),
    status: (r.status as JobPosting['status']) ?? 'OPEN',
  };
}

function toApplication(r: Record<string, unknown>): Application {
  return {
    id: String(r.id ?? ''),
    posting_id: String(r.posting_id ?? ''),
    full_name: String(r.full_name ?? ''),
    email: String(r.email ?? ''),
    phone: String(r.phone ?? ''),
    cv_file_url: String(r.cv_file_url ?? ''),
    source: String(r.source ?? ''),
    cover_note: String(r.cover_note ?? ''),
    stage: (r.stage as AppStage) ?? 'NEW',
    score: r.score === null || r.score === undefined ? null : Number(r.score),
    screening_notes: String(r.screening_notes ?? ''),
  };
}

function toInterview(r: Record<string, unknown>): Interview {
  return {
    id: String(r.id ?? ''),
    application_id: String(r.application_id ?? ''),
    interviewers: String(r.interviewers ?? ''),
    scheduled_at: String(r.scheduled_at ?? ''),
    location: String(r.location ?? ''),
    meeting_link: String(r.meeting_link ?? ''),
    result: (r.result as Interview['result']) ?? 'PENDING',
    notes: String(r.notes ?? ''),
  };
}

function toOffer(r: Record<string, unknown>): Offer {
  return {
    id: String(r.id ?? ''),
    application_id: String(r.application_id ?? ''),
    salary_offered: Number(r.salary_offered ?? 0),
    start_date: String(r.start_date ?? '').slice(0, 10),
    status: (r.status as Offer['status']) ?? 'DRAFT',
  };
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
    async listPostings() { return m.listPostings(); },
    async createPosting(i) { return m.createPosting(i); },
    async listApplications() { return m.listApplications(); },
    async createApplication(i) { return m.createApplication(i); },
    async moveApplication(id, s) { m.moveApplication(id, s); },
    async setApplicationScore(id, s, n) { m.setApplicationScore(id, s, n); },
    async screenApplication(id) {
      const a = m.listApplications().find((x) => x.id === id);
      const score = a ? 60 + (a.full_name.length * 7) % 40 : 70;
      m.setApplicationScore(id, score, 'Điểm demo (chế độ offline, không gọi LLM).');
      return { score };
    },
    async listInterviews() { return m.listInterviews(); },
    async scheduleInterview(i) { return m.scheduleInterview(i); },
    async setInterviewResult(id, r, n) { m.setInterviewResult(id, r, n); },
    async listOffers() { return m.listOffers(); },
    async createOffer(i) { return m.createOffer(i); },
    async hireFromOffer(id) { return m.hireFromOffer(id); },
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
    async listPostings() {
      return (await rows<Record<string, unknown>>('hr_job_postings')).map(toPosting);
    },
    async createPosting(i) {
      return toPosting(await client.post(`${R}/hr_job_postings`, i));
    },
    async listApplications() {
      return (await rows<Record<string, unknown>>('hr_applications')).map(toApplication);
    },
    // P2: tạo hồ sơ đi qua workflow wf_application_received (ghi DB + validate).
    async createApplication(i) {
      const res = await client.post<Record<string, unknown>>(
        `${A}/wf_application_received`,
        { payload: { ...i } },
      );
      if (res && res.application_id) {
        const all = await this.listApplications();
        const found = all.find((a) => a.id === String(res.application_id));
        if (found) return found;
      }
      const all = await this.listApplications();
      const found = all.find((a) => a.email && a.email === i.email);
      if (found) return found;
      throw new Error('Tạo hồ sơ xong nhưng chưa thấy trong DB — tải lại sau giây lát.');
    },
    async moveApplication(id, stage) {
      await client.patch(`${R}/hr_applications/${id}`, { stage });
    },
    // P3: AI chấm điểm qua workflow wf_application_screen (Ollama local).
    // LLM CPU ~1 phút — caller tự xử timeout/502 (coi như đang chạy ngầm).
    async screenApplication(id: string): Promise<{ score: number | null }> {
      const res = await client.post<Record<string, unknown>>(
        `${A}/wf_application_screen`,
        { payload: { application_id: id } },
      );
      const score = res && typeof res.score === 'number' ? res.score : null;
      return { score };
    },
    async setApplicationScore(id, score, notes) {
      await client.patch(`${R}/hr_applications/${id}`, { score, screening_notes: notes });
    },
    async listInterviews() {
      return (await rows<Record<string, unknown>>('hr_interviews')).map(toInterview);
    },
    // P2: đặt lịch đi qua workflow wf_interview_schedule
    // (ghi lịch + chuyển stage INTERVIEW trong 1 gọi).
    async scheduleInterview(i) {
      const res = await client.post<Record<string, unknown>>(
        `${A}/wf_interview_schedule`,
        { payload: { ...i } },
      );
      if (res && res.interview_id) {
        const all = await this.listInterviews();
        const found = all.find((x) => x.id === String(res.interview_id));
        if (found) return found;
      }
      const all = await this.listInterviews();
      const found = all.find((x) => x.application_id === i.application_id);
      if (found) return found;
      throw new Error('Đặt lịch xong nhưng chưa thấy trong DB — tải lại sau giây lát.');
    },
    async setInterviewResult(id, result, notes) {
      await client.patch(`${R}/hr_interviews/${id}`, { result, notes });
    },
    async listOffers() {
      return (await rows<Record<string, unknown>>('hr_offers')).map(toOffer);
    },
    async createOffer(i) {
      return toOffer(await client.post(`${R}/hr_offers`, i));
    },
    async hireFromOffer(offer_id) {
      const offers = await this.listOffers();
      const offer = offers.find((o) => o.id === offer_id);
      if (!offer) throw new Error('Không tìm thấy offer');
      const apps = await this.listApplications();
      const app = apps.find((a) => a.id === offer.application_id);
      if (!app) throw new Error('Không tìm thấy hồ sơ');
      const employees = await this.listEmployees();
      const emp = await this.createEmployee({
        employee_code: `NV${String(employees.length + 1).padStart(3, '0')}`,
        full_name: app.full_name,
        email: app.email,
        department_id: '',
        position: '',
        hire_date: new Date().toISOString().slice(0, 10),
        status: 'active',
        annual_leave_balance: 12,
      });
      await this.moveApplication(app.id, 'HIRED');
      await client.patch(`${R}/hr_offers/${offer_id}`, { status: 'ACCEPTED' });
      return emp;
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
