// Finance Module — seed mở rộng từ db/seed_data.sql (giữ nguyên 5 tài khoản gốc).
import type {
  ExpenseRequest,
  FinanceAccount,
  FinanceBudget,
  FinanceInvoice,
  FinanceTransaction,
} from '../types';

export const seedAccounts: FinanceAccount[] = [
  // ── 5 dòng gốc từ db/seed_data.sql ──
  { id: '11111111-1111-1111-1111-111111111111', code: '111', name: 'Tiền mặt', type: 'ASSET', parent_id: null },
  { id: '22222222-2222-2222-2222-222222222222', code: '112', name: 'Tiền gửi ngân hàng', type: 'ASSET', parent_id: null },
  { id: '33333333-3333-3333-3333-333333333333', code: '331', name: 'Phải trả người bán', type: 'LIABILITY', parent_id: null },
  { id: '44444444-4444-4444-4444-444444444444', code: '511', name: 'Doanh thu bán hàng', type: 'REVENUE', parent_id: null },
  { id: '55555555-5555-5555-5555-555555555555', code: '642', name: 'Chi phí quản lý doanh nghiệp', type: 'EXPENSE', parent_id: null },
  // ── mở rộng thực tế VN ──
  { id: '66666666-6666-6666-6666-666666666666', code: '131', name: 'Phải thu khách hàng', type: 'ASSET', parent_id: null },
  { id: '77777777-7777-7777-7777-777777777777', code: '333', name: 'Thuế phải nộp (VAT)', type: 'LIABILITY', parent_id: null },
  { id: '88888888-8888-8888-8888-888888888888', code: '641', name: 'Chi phí bán hàng', type: 'EXPENSE', parent_id: null },
  { id: '99999999-9999-9999-9999-999999999999', code: '515', name: 'Doanh thu hoạt động tài chính', type: 'REVENUE', parent_id: null },
];

const CASH = '11111111-1111-1111-1111-111111111111';
const BANK = '22222222-2222-2222-2222-222222222222';
const PAYABLE = '33333333-3333-3333-3333-333333333333';
const REVENUE = '44444444-4444-4444-4444-444444444444';
const ADMIN = '55555555-5555-5555-5555-555555555555';

export const seedTransactions: FinanceTransaction[] = [
  {
    id: 't1t1t1t1-1111-1111-1111-111111111111',
    transaction_date: '2026-09-01',
    account_id: BANK,
    amount: 250000000,
    type: 'CREDIT',
    category: 'Bán hàng',
    description: 'Thu tiền hợp đồng triển khai ERP — Cty An Phát (đợt 1)',
    proof_url: '',
  },
  {
    id: 't1t1t1t1-2222-2222-2222-222222222222',
    transaction_date: '2026-09-02',
    account_id: BANK,
    amount: 85000000,
    type: 'DEBIT',
    category: 'Lương',
    description: 'Chi lương tháng 8/2026 (32 nhân sự)',
    proof_url: '',
  },
  {
    id: 't1t1t1t1-3333-3333-3333-333333333333',
    transaction_date: '2026-09-03',
    account_id: CASH,
    amount: 12500000,
    type: 'DEBIT',
    category: 'Văn phòng',
    description: 'Mua văn phòng phẩm + nước uống Q3 (Siêu thị Thành Đô)',
    proof_url: '',
  },
  {
    id: 't1t1t1t1-4444-4444-4444-444444444444',
    transaction_date: '2026-09-04',
    account_id: REVENUE,
    amount: 120000000,
    type: 'CREDIT',
    category: 'Dịch vụ',
    description: 'Thu phí bảo trì hạ tầng mạng Q3 — KCN Điềm Thụy',
    proof_url: '',
  },
  {
    id: 't1t1t1t1-5555-5555-5555-555555555555',
    transaction_date: '2026-09-05',
    account_id: PAYABLE,
    amount: 68000000,
    type: 'DEBIT',
    category: 'Thiết bị',
    description: 'Trả NCC Phong Vũ — 10 laptop Dell Vostro',
    proof_url: '',
  },
  {
    id: 't1t1t1t1-6666-6666-6666-666666666666',
    transaction_date: '2026-09-06',
    account_id: ADMIN,
    amount: 9800000,
    type: 'DEBIT',
    category: 'Thuê văn phòng',
    description: 'Thuê văn phòng tháng 9 — tầng 5, tòa ICTU Hub',
    proof_url: '',
  },
  {
    id: 't1t1t1t1-7777-7777-7777-777777777777',
    transaction_date: '2026-09-07',
    account_id: BANK,
    amount: 45000000,
    type: 'CREDIT',
    category: 'Bán hàng',
    description: 'Thu tiền tư vấn chuyển đổi số — Sở TT&TT (tạm ứng)',
    proof_url: '',
  },
  {
    id: 't1t1t1t1-8888-8888-8888-888888888888',
    transaction_date: '2026-09-08',
    account_id: CASH,
    amount: 15300000,
    type: 'DEBIT',
    category: 'Công tác',
    description: 'Công tác Hà Nội: vé xe + khách sạn 3 ngày (anh Cường)',
    proof_url: '',
  },
];

export const seedInvoices: FinanceInvoice[] = [
  {
    id: 'i1i1i1i1-1111-1111-1111-111111111111',
    invoice_number: 'HĐ-2026-0081',
    vendor_name: 'Cty TNHH Phong Vũ Thái Nguyên',
    amount: 68000000,
    issue_date: '2026-08-28',
    due_date: '2026-09-27',
    status: 'PENDING',
    file_url: '',
  },
  {
    id: 'i1i1i1i1-2222-2222-2222-222222222222',
    invoice_number: 'HĐ-2026-0074',
    vendor_name: 'VNPT Thái Nguyên',
    amount: 8400000,
    issue_date: '2026-08-05',
    due_date: '2026-09-05',
    status: 'OVERDUE',
    file_url: '',
  },
  {
    id: 'i1i1i1i1-3333-3333-3333-333333333333',
    invoice_number: 'HĐ-2026-0069',
    vendor_name: 'Điện lực TP. Thái Nguyên',
    amount: 12750000,
    issue_date: '2026-08-01',
    due_date: '2026-08-31',
    status: 'PAID',
    file_url: '',
  },
  {
    id: 'i1i1i1i1-4444-4444-4444-444444444444',
    invoice_number: 'HĐ-2026-0085',
    vendor_name: 'Cty CP Viễn thông FPT',
    amount: 5200000,
    issue_date: '2026-09-02',
    due_date: '2026-10-02',
    status: 'PENDING',
    file_url: '',
  },
  {
    id: 'i1i1i1i1-5555-5555-5555-555555555555',
    invoice_number: 'HĐ-2026-0058',
    vendor_name: 'Nhà sách Tiến Thọ',
    amount: 3100000,
    issue_date: '2026-07-10',
    due_date: '2026-08-10',
    status: 'CANCELLED',
    file_url: '',
  },
];

export const seedExpenses: ExpenseRequest[] = [
  {
    id: 'e1e1e1e1-1111-1111-1111-111111111111',
    requester_id: 'Nguyễn Văn An',
    requester_name: 'Nguyễn Văn An',
    amount: 3500000,
    category: 'Công tác',
    reason: 'Đi khảo sát hạ tầng KCN Điềm Thụy 2 ngày (xăng xe + ăn ở)',
    status: 'APPROVED',
    approved_by: 'Trần Thị Bình',
    created_at: '2026-08-20T08:00:00.000Z',
  },
  {
    id: 'e1e1e1e1-2222-2222-2222-222222222222',
    requester_id: 'Lê Văn Cường',
    requester_name: 'Lê Văn Cường',
    amount: 12000000,
    category: 'Thiết bị',
    reason: 'Mua 2 màn hình Dell 27" cho phòng dev mới',
    status: 'PENDING',
    approved_by: null,
    created_at: '2026-09-06T08:00:00.000Z',
  },
  {
    id: 'e1e1e1e1-3333-3333-3333-333333333333',
    requester_id: 'Phạm Thị Dung',
    requester_name: 'Phạm Thị Dung',
    amount: 8000000,
    category: 'Đào tạo',
    reason: 'Khóa học quản trị dự án PMP cho 2 nhân sự (học phí)',
    status: 'PENDING',
    approved_by: null,
    created_at: '2026-09-08T08:00:00.000Z',
  },
  {
    id: 'e1e1e1e1-4444-4444-4444-444444444444',
    requester_id: 'Hoàng Minh Đức',
    requester_name: 'Hoàng Minh Đức',
    amount: 2500000,
    category: 'Văn phòng',
    reason: 'In ấn hồ sơ thầu (hoàn ứng, thiếu hóa đơn VAT)',
    status: 'REJECTED',
    approved_by: 'Trần Thị Bình',
    created_at: '2026-08-25T08:00:00.000Z',
  },
];

export const seedBudgets: FinanceBudget[] = [
  { id: 'b1b1b1b1-1111-1111-1111-111111111111', department_id: null, project_id: null, month: '2026-09', category: 'Lương', allocated_amount: 120000000, spent_amount: 85000000 },
  { id: 'b1b1b1b1-2222-2222-2222-222222222222', department_id: null, project_id: null, month: '2026-09', category: 'Thiết bị', allocated_amount: 80000000, spent_amount: 68000000 },
  { id: 'b1b1b1b1-3333-3333-3333-333333333333', department_id: null, project_id: null, month: '2026-09', category: 'Văn phòng', allocated_amount: 20000000, spent_amount: 12500000 },
  { id: 'b1b1b1b1-4444-4444-4444-444444444444', department_id: null, project_id: null, month: '2026-09', category: 'Công tác', allocated_amount: 30000000, spent_amount: 15300000 },
];
