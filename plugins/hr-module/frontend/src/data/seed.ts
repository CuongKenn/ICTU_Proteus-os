// HR Core — seed mở rộng từ db/seed_data.sql (giữ nguyên ID + dòng gốc:
// 3 phòng ban HR/IT/ACC, NV001 Nguyễn Văn A, NV002 Trần Thị B, NV003 Nguyễn Văn Trung).
import type {
  Application,
  AttendanceLog,
  Department,
  Employee,
  Interview,
  JobPosting,
  LeaveBalance,
  LeaveRequest,
  Offer,
  OnboardingTask,
  PayrollRecord,
} from '../types';

export const seedDepartments: Department[] = [
  { id: '11111111-1111-1111-1111-111111111111', code: 'HR', name: 'Phòng Nhân sự' },
  { id: '22222222-2222-2222-2222-222222222222', code: 'IT', name: 'Phòng Công nghệ thông tin' },
  { id: '33333333-3333-3333-3333-333333333333', code: 'ACC', name: 'Phòng Kế toán' },
  { id: '44444444-4444-4444-4444-444444444444', code: 'SALE', name: 'Phòng Kinh doanh' },
  { id: '55555555-5555-5555-5555-555555555555', code: 'ADMIN', name: 'Phòng Hành chính' },
];

const HR = '11111111-1111-1111-1111-111111111111';
const IT = '22222222-2222-2222-2222-222222222222';
const ACC = '33333333-3333-3333-3333-333333333333';
const SALE = '44444444-4444-4444-4444-444444444444';
const ADMIN = '55555555-5555-5555-5555-555555555555';

export const seedEmployees: Employee[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    employee_code: 'NV001',
    full_name: 'Nguyễn Văn A',
    email: 'nva@company.com',
    department_id: HR,
    position: 'HR Manager',
    hire_date: '2023-01-01',
    status: 'active',
    annual_leave_balance: 12,
    emergency_contact: '0912345678 (vợ)',
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    employee_code: 'NV002',
    full_name: 'Trần Thị B',
    email: 'ttb@company.com',
    department_id: IT,
    position: 'Developer',
    hire_date: '2023-06-15',
    status: 'active',
    annual_leave_balance: 6,
    emergency_contact: '0987654321 (chồng)',
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    employee_code: 'NV003',
    full_name: 'Nguyễn Văn Trung',
    email: 'trung@company.com',
    department_id: IT,
    position: 'Software Engineer',
    hire_date: '2023-08-01',
    status: 'active',
    annual_leave_balance: 10,
    emergency_contact: '0905123456 (mẹ)',
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    employee_code: 'NV004',
    full_name: 'Lê Thị Hồng Nhung',
    email: 'nhung.lth@company.com',
    department_id: ACC,
    position: 'Kế toán tổng hợp',
    hire_date: '2022-03-10',
    status: 'active',
    annual_leave_balance: 8,
    emergency_contact: '0938111222 (anh trai)',
  },
  {
    id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    employee_code: 'NV005',
    full_name: 'Phạm Quốc Bảo',
    email: 'bao.pq@company.com',
    department_id: SALE,
    position: 'Trưởng phòng Kinh doanh',
    hire_date: '2021-11-01',
    status: 'active',
    annual_leave_balance: 4,
    emergency_contact: '0909333444 (vợ)',
  },
  {
    id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    employee_code: 'NV006',
    full_name: 'Hoàng Thị Mai Linh',
    email: 'linh.htm@company.com',
    department_id: SALE,
    position: 'Nhân viên Kinh doanh',
    hire_date: '2024-02-20',
    status: 'active',
    annual_leave_balance: 11,
    emergency_contact: '0971222333 (mẹ)',
  },
  {
    id: '11111111-aaaa-bbbb-cccc-111111111111',
    employee_code: 'NV007',
    full_name: 'Đỗ Văn Minh',
    email: 'minh.dv@company.com',
    department_id: IT,
    position: 'QA Engineer',
    hire_date: '2024-07-01',
    status: 'active',
    annual_leave_balance: 12,
    emergency_contact: '0915444555 (bố)',
  },
  {
    id: '22222222-aaaa-bbbb-cccc-222222222222',
    employee_code: 'NV008',
    full_name: 'Vũ Thị Thanh Hằng',
    email: 'hang.vtt@company.com',
    department_id: ADMIN,
    position: 'Lễ tân',
    hire_date: '2025-01-15',
    status: 'active',
    annual_leave_balance: 12,
    emergency_contact: '0986666777 (chị gái)',
  },
  {
    id: '33333333-aaaa-bbbb-cccc-333333333333',
    employee_code: 'NV009',
    full_name: 'Bùi Đức Anh',
    email: 'anh.bd@company.com',
    department_id: ACC,
    position: 'Thủ quỹ',
    hire_date: '2020-05-01',
    status: 'inactive',
    annual_leave_balance: 0,
    emergency_contact: '0901888999 (vợ)',
  },
];

export const seedLeaveBalances: LeaveBalance[] = [
  { id: 'b1b1b1b1-1111-1111-1111-111111111111', employee_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', year: 2026, remaining_days: 12 },
  { id: 'b1b1b1b1-2222-2222-2222-222222222222', employee_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', year: 2026, remaining_days: 6 },
  { id: 'b1b1b1b1-3333-3333-3333-333333333333', employee_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', year: 2026, remaining_days: 10 },
  { id: 'b1b1b1b1-4444-4444-4444-444444444444', employee_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', year: 2026, remaining_days: 8 },
  { id: 'b1b1b1b1-5555-5555-5555-555555555555', employee_id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', year: 2026, remaining_days: 4 },
  { id: 'b1b1b1b1-6666-6666-6666-666666666666', employee_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', year: 2026, remaining_days: 11 },
];

export const seedLeaveRequests: LeaveRequest[] = [
  {
    id: 'c1c1c1c1-1111-1111-1111-111111111111',
    employee_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    start_date: '2026-09-15',
    end_date: '2026-09-16',
    duration_days: 2,
    status: 'PENDING',
    created_at: '2026-09-08T08:00:00.000Z',
  },
  {
    id: 'c1c1c1c1-2222-2222-2222-222222222222',
    employee_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    start_date: '2026-09-21',
    end_date: '2026-09-23',
    duration_days: 3,
    status: 'PENDING',
    created_at: '2026-09-09T08:30:00.000Z',
  },
  {
    id: 'c1c1c1c1-3333-3333-3333-333333333333',
    employee_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    start_date: '2026-08-04',
    end_date: '2026-08-06',
    duration_days: 3,
    status: 'APPROVED',
    created_at: '2026-07-28T09:00:00.000Z',
  },
  {
    id: 'c1c1c1c1-4444-4444-4444-444444444444',
    employee_id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    start_date: '2026-07-10',
    end_date: '2026-07-14',
    duration_days: 5,
    status: 'APPROVED',
    created_at: '2026-07-01T10:00:00.000Z',
  },
  {
    id: 'c1c1c1c1-5555-5555-5555-555555555555',
    employee_id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    start_date: '2026-09-02',
    end_date: '2026-09-05',
    duration_days: 4,
    status: 'REJECTED',
    created_at: '2026-08-29T14:00:00.000Z',
  },
  {
    id: 'c1c1c1c1-6666-6666-6666-666666666666',
    employee_id: '11111111-aaaa-bbbb-cccc-111111111111',
    start_date: '2026-06-02',
    end_date: '2026-06-02',
    duration_days: 1,
    status: 'REJECTED',
    created_at: '2026-05-30T08:00:00.000Z',
  },
];

export const seedAttendance: AttendanceLog[] = [
  { id: 'd1d1d1d1-1111-1111-1111-111111111111', employee_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', log_time: '2026-09-10T08:02:00.000Z' },
  { id: 'd1d1d1d1-2222-2222-2222-222222222222', employee_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', log_time: '2026-09-10T07:55:00.000Z' },
  { id: 'd1d1d1d1-3333-3333-3333-333333333333', employee_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', log_time: '2026-09-10T08:10:00.000Z' },
  { id: 'd1d1d1d1-4444-4444-4444-444444444444', employee_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', log_time: '2026-09-10T08:25:00.000Z' },
  { id: 'd1d1d1d1-5555-5555-5555-555555555555', employee_id: '11111111-aaaa-bbbb-cccc-111111111111', log_time: '2026-09-10T07:48:00.000Z' },
];

export const seedPayroll: PayrollRecord[] = [
  { id: 'e1e1e1e1-1111-1111-1111-111111111111', employee_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', amount: 25000000 },
  { id: 'e1e1e1e1-2222-2222-2222-222222222222', employee_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', amount: 18000000 },
  { id: 'e1e1e1e1-3333-3333-3333-333333333333', employee_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', amount: 20000000 },
  { id: 'e1e1e1e1-4444-4444-4444-444444444444', employee_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', amount: 16000000 },
  { id: 'e1e1e1e1-5555-5555-5555-555555555555', employee_id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', amount: 22000000 },
];

export const seedOnboarding: OnboardingTask[] = [
  { id: 'f1f1f1f1-1111-1111-1111-111111111111', employee_id: '22222222-aaaa-bbbb-cccc-222222222222', task_name: 'Cấp tài khoản email công ty', is_completed: true },
  { id: 'f1f1f1f1-2222-2222-2222-222222222222', employee_id: '22222222-aaaa-bbbb-cccc-222222222222', task_name: 'Cấp laptop + thiết bị', is_completed: false },
  { id: 'f1f1f1f1-3333-3333-3333-333333333333', employee_id: '22222222-aaaa-bbbb-cccc-222222222222', task_name: 'Đào tạo nội quy công ty', is_completed: false },
  { id: 'f1f1f1f1-4444-4444-4444-444444444444', employee_id: '11111111-aaaa-bbbb-cccc-111111111111', task_name: 'Cấp tài khoản email công ty', is_completed: true },
  { id: 'f1f1f1f1-5555-5555-5555-555555555555', employee_id: '11111111-aaaa-bbbb-cccc-111111111111', task_name: 'Đào tạo quy trình QA', is_completed: true },
];

export const seedPostings: JobPosting[] = [
  {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    title: 'Backend Developer (Python)',
    department_id: '22222222-2222-2222-2222-222222222222',
    employment_type: 'FULLTIME',
    location: 'Thái Nguyên',
    salary_min: 15000000,
    salary_max: 25000000,
    description: 'Phát triển Core Engine FastAPI cho Proteus OS.',
    requirements: 'Python 3.12, FastAPI, PostgreSQL, Docker.',
    status: 'OPEN',
  },
  {
    id: 'aaaaaaaa-0000-4000-8000-000000000002',
    title: 'Kế toán tổng hợp',
    department_id: '33333333-3333-3333-3333-333333333333',
    employment_type: 'FULLTIME',
    location: 'Thái Nguyên',
    salary_min: 12000000,
    salary_max: 18000000,
    description: 'Theo dõi thu chi, lập báo cáo tài chính.',
    requirements: 'Tốt nghiệp kế toán, 2 năm kinh nghiệm.',
    status: 'OPEN',
  },
];

export const seedApplications: Application[] = [
  {
    id: 'bbbbbbbb-0000-4000-8000-000000000001',
    posting_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    full_name: 'Phạm Văn E',
    email: 'e@example.com',
    phone: '0911111111',
    cv_file_url: '',
    source: 'WEBSITE',
    cover_note: '3 năm Python backend.',
    stage: 'NEW',
    score: null,
    screening_notes: '',
  },
  {
    id: 'bbbbbbbb-0000-4000-8000-000000000002',
    posting_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    full_name: 'Hoàng Thị F',
    email: 'f@example.com',
    phone: '0922222222',
    cv_file_url: '',
    source: 'REFERRAL',
    cover_note: '',
    stage: 'SCREENING',
    score: 82,
    screening_notes: 'Khớp 4/5 yêu cầu, hẹn phỏng vấn.',
  },
];

export const seedInterviews: Interview[] = [
  {
    id: 'cccccccc-0000-4000-8000-000000000001',
    application_id: 'bbbbbbbb-0000-4000-8000-000000000002',
    interviewers: 'Nguyễn Văn A, Trần Thị B',
    scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(),
    location: 'Phòng họp Tầng 3',
    meeting_link: '',
    result: 'PENDING',
    notes: 'Vòng kỹ thuật 60 phút.',
  },
];

export const seedOffers: Offer[] = [];
