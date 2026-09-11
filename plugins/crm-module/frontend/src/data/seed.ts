// CRM seed — giữ 2 dòng gốc từ db/seed_data.sql, mở rộng thêm để demo kanban.
import type {
  Contact,
  Customer,
  Lead,
  Opportunity,
  Ticket,
  TicketComment,
} from '../types';

const now = Date.now();
const iso = (daysFromNow: number) =>
  new Date(now + daysFromNow * 86400000).toISOString();

export const seedCustomers: Customer[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Công ty Cổ phần Công nghệ ABC', type: 'B2B', industry: 'IT', company_size: '100-500', status: 'ACTIVE' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Tập đoàn DEF', type: 'B2B', industry: 'Finance', company_size: '500+', status: 'ACTIVE' },
  { id: '33333333-0000-0000-0000-000000000001', name: 'Công ty TNHH XYZ', type: 'B2B', industry: 'Retail', company_size: '50-100', status: 'ACTIVE' },
  { id: '33333333-0000-0000-0000-000000000002', name: 'Sở Giáo dục Tỉnh T', type: 'GOVERNMENT', industry: 'Education', company_size: '500+', status: 'ACTIVE' },
];

export const seedContacts: Contact[] = [
  { id: '33333333-3333-3333-3333-333333333333', customer_id: '11111111-1111-1111-1111-111111111111', name: 'Nguyễn Văn A', email: 'nguyenvana@abc.com', phone: '0901234567', position: 'Giám đốc IT', is_primary: true },
  { id: 'c2c2c2c2-0000-0000-0000-000000000001', customer_id: '22222222-2222-2222-2222-222222222222', name: 'Lê Thị C', email: 'lec@def.com', phone: '0912345678', position: 'CFO', is_primary: true },
  { id: 'c2c2c2c2-0000-0000-0000-000000000002', customer_id: '33333333-0000-0000-0000-000000000001', name: 'Phạm Văn D', email: 'd@xyz.com', phone: '0987654321', position: 'Founder', is_primary: true },
];

export const seedLeads: Lead[] = [
  { id: '44444444-4444-4444-4444-444444444444', contact_name: 'Trần Thị B', company_name: 'Công ty TNHH XYZ', email: 'tranthib@xyz.com', phone: '', source: 'WEBSITE', estimated_value: 100000000, stage: 'NEW' },
  { id: 'l2l2l2l2-0000-0000-0000-000000000001', contact_name: 'Hoàng Văn E', company_name: 'Công ty GHI', email: 'e@ghi.com', phone: '0902111222', source: 'REFERRAL', estimated_value: 250000000, stage: 'CONTACTED' },
  { id: 'l2l2l2l2-0000-0000-0000-000000000002', contact_name: 'Vũ Thị F', company_name: 'Sở Giáo dục Tỉnh T', email: 'f@edu.vn', phone: '', source: 'EVENT', estimated_value: 800000000, stage: 'QUALIFIED' },
  { id: 'l2l2l2l2-0000-0000-0000-000000000003', contact_name: 'Đỗ Văn G', company_name: 'Shop G', email: 'g@shop.vn', phone: '', source: 'COLD_CALL', estimated_value: 30000000, stage: 'NEW' },
  { id: 'l2l2l2l2-0000-0000-0000-000000000004', contact_name: 'Ngô Thị H', company_name: 'Công ty H', email: 'h@h.vn', phone: '', source: 'WEBSITE', estimated_value: 120000000, stage: 'LOST' },
];

export const seedOpportunities: Opportunity[] = [
  { id: 'o1o1o1o1-0000-0000-0000-000000000001', customer_id: '11111111-1111-1111-1111-111111111111', title: 'Triển khai Proteus HRM', value: 450000000, probability_pct: 20, expected_close_date: '2026-11-30', stage: 'PROSPECTING' },
  { id: 'o1o1o1o1-0000-0000-0000-000000000002', customer_id: '22222222-2222-2222-2222-222222222222', title: 'Core banking dashboard', value: 1200000000, probability_pct: 50, expected_close_date: '2026-12-15', stage: 'PROPOSAL' },
  { id: 'o1o1o1o1-0000-0000-0000-000000000003', customer_id: '33333333-0000-0000-0000-000000000001', title: 'POS + CRM chuỗi bán lẻ', value: 300000000, probability_pct: 70, expected_close_date: '2026-10-20', stage: 'NEGOTIATION' },
  { id: 'o1o1o1o1-0000-0000-0000-000000000004', customer_id: '33333333-0000-0000-0000-000000000002', title: 'Quản lý văn bản Sở', value: 900000000, probability_pct: 40, expected_close_date: '2026-12-01', stage: 'QUALIFICATION' },
  { id: 'o1o1o1o1-0000-0000-0000-000000000005', customer_id: '11111111-1111-1111-1111-111111111111', title: 'Gói bảo trì năm 2025', value: 150000000, probability_pct: 100, expected_close_date: '2026-08-01', stage: 'CLOSED_WON' },
];

export const seedTickets: Ticket[] = [
  { id: 't1t1t1t1-0000-0000-0000-000000000001', customer_id: '11111111-1111-1111-1111-111111111111', title: 'Không đăng nhập được SSO', description: 'User báo lỗi Keycloak redirect loop trên Chrome', priority: 'P1', status: 'IN_PROGRESS', sla_deadline: iso(0.5), assignee: 'Support A', created_at: iso(-1) },
  { id: 't1t1t1t1-0000-0000-0000-000000000002', customer_id: '22222222-2222-2222-2222-222222222222', title: 'Sai số dư báo cáo', description: 'Dashboard Metabase lệch so với sổ kế toán', priority: 'P2', status: 'OPEN', sla_deadline: iso(2), assignee: 'Support B', created_at: iso(-0.5) },
  { id: 't1t1t1t1-0000-0000-0000-000000000003', customer_id: '33333333-0000-0000-0000-000000000001', title: 'Xin thêm user POS', description: 'Thêm 5 thu ngân chi nhánh mới', priority: 'P3', status: 'WAITING_ON_CUSTOMER', sla_deadline: iso(5), assignee: 'Support A', created_at: iso(-2) },
  { id: 't1t1t1t1-0000-0000-0000-000000000004', customer_id: '11111111-1111-1111-1111-111111111111', title: 'Đề xuất tính năng NPS', description: 'Khảo sát sau bán như wf_customer_satisfaction', priority: 'P4', status: 'RESOLVED', sla_deadline: iso(-1), assignee: 'Support C', created_at: iso(-5) },
];

export const seedComments: TicketComment[] = [
  { id: 'm1m1m1m1-0000-0000-0000-000000000001', ticket_id: 't1t1t1t1-0000-0000-0000-000000000001', user: 'Support A', content: 'Đã reproduce, đang fix callback URL Keycloak.', created_at: iso(-0.8) },
];
