// Document Module — seed mở rộng từ db/seed_data.sql (giữ nguyên 5 dòng
// document_categories gốc) + dữ liệu VN thực tế cho văn bản đến/đi,
// phê duyệt, phân phối.
import type {
  ApprovalItem,
  DistributionItem,
  DocumentCategory,
  IncomingDoc,
  OutgoingDoc,
} from '../types';

export const seedCategories: DocumentCategory[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Nghị quyết', description: 'Nghị quyết của Đảng ủy, Hội đồng trường' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Quyết định', description: 'Quyết định hành chính' },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Công văn', description: 'Công văn trao đổi công việc' },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Thông báo', description: 'Thông báo nội bộ' },
  { id: '55555555-5555-5555-555555555555', name: 'Tờ trình', description: 'Tờ trình xin phê duyệt' },
];

export const seedIncoming: IncomingDoc[] = [
  {
    id: 'a1010101-1111-1111-1111-111111111111',
    so_van_ban: '1234/BGDĐT-VP',
    noi_gui: 'Bộ Giáo dục và Đào tạo',
    ngay_nhan: '2026-09-02',
    trich_yeu: 'V/v hướng dẫn thực hiện nhiệm vụ năm học 2026-2027',
    file_url: '',
    assignee_id: 'Phòng Đào tạo',
    status: 'processing',
  },
  {
    id: 'a1010101-2222-2222-2222-222222222222',
    so_van_ban: '567/UBND-VX',
    noi_gui: 'UBND tỉnh Thái Nguyên',
    ngay_nhan: '2026-09-05',
    trich_yeu: 'V/v tăng cường chuyển đổi số trong cơ quan nhà nước',
    file_url: '',
    assignee_id: 'Phòng Hành chính',
    status: 'received',
  },
  {
    id: 'a1010101-3333-3333-3333-333333333333',
    so_van_ban: '89/SKHCN-QLKH',
    noi_gui: 'Sở Khoa học và Công nghệ',
    ngay_nhan: '2026-08-20',
    trich_yeu: 'V/v đề xuất nhiệm vụ KH&CN cấp tỉnh năm 2027',
    file_url: '',
    assignee_id: 'Phòng Khoa học',
    status: 'processing',
  },
  {
    id: 'a1010101-4444-4444-4444-444444444444',
    so_van_ban: '210/STC-NS',
    noi_gui: 'Sở Tài chính',
    ngay_nhan: '2026-07-28',
    trich_yeu: 'V/v quyết toán ngân sách 6 tháng đầu năm 2026',
    file_url: '',
    assignee_id: 'Phòng Tài vụ',
    status: 'done',
  },
  {
    id: 'a1010101-5555-5555-5555-555555555555',
    so_van_ban: '45/CV-EVN',
    noi_gui: 'Công ty Điện lực Thái Nguyên',
    ngay_nhan: '2026-09-08',
    trich_yeu: 'V/v lịch cắt điện bảo trì lưới khu vực Quyết Thắng',
    file_url: '',
    assignee_id: null,
    status: 'received',
  },
];

export const seedOutgoing: OutgoingDoc[] = [
  {
    id: 'b2020202-1111-1111-1111-111111111111',
    so_van_ban: '156/QĐ-ICTU',
    loai_vb: '22222222-2222-2222-2222-222222222222',
    nguoi_ky: 'PGS.TS Nguyễn Văn An',
    ngay_phat_hanh: '2026-09-01',
    file_url: '',
    status: 'published',
    tieu_de: 'QĐ thành lập Hội đồng tuyển sinh 2026',
  },
  {
    id: 'b2020202-2222-2222-2222-222222222222',
    so_van_ban: '320/TB-ICTU',
    loai_vb: '44444444-4444-4444-4444-444444444444',
    nguoi_ky: 'TS. Trần Thị Bình',
    ngay_phat_hanh: '2026-09-06',
    file_url: '',
    status: 'signed',
    tieu_de: 'Thông báo lịch nghỉ lễ Quốc khánh 2/9',
  },
  {
    id: 'b2020202-3333-3333-3333-333333333333',
    so_van_ban: '',
    loai_vb: '55555555-5555-5555-555555555555',
    nguoi_ky: null,
    ngay_phat_hanh: '2026-09-10',
    file_url: '',
    status: 'draft',
    tieu_de: 'Tờ trình mua sắm máy chủ phục vụ đào tạo AI',
  },
  {
    id: 'b2020202-4444-4444-4444-444444444444',
    so_van_ban: '',
    loai_vb: '33333333-3333-3333-3333-333333333333',
    nguoi_ky: null,
    ngay_phat_hanh: '2026-09-09',
    file_url: '',
    status: 'pending',
    tieu_de: 'Công văn phúc đáp Sở KHCN về nhiệm vụ 2027',
  },
];

export const seedApprovals: ApprovalItem[] = [
  {
    id: 'c3030303-1111-1111-1111-111111111111',
    document_id: 'b2020202-4444-4444-4444-444444444444',
    document_type: 'outgoing',
    approver_id: 'Trưởng phòng Hành chính',
    order_no: 1,
    status: 'approved',
    signed_at: '2026-09-09T09:30:00.000Z',
    note: 'Nhất trí nội dung phúc đáp',
  },
  {
    id: 'c3030303-2222-2222-2222-222222222222',
    document_id: 'b2020202-4444-4444-4444-444444444444',
    document_type: 'outgoing',
    approver_id: 'PGS.TS Nguyễn Văn An',
    order_no: 2,
    status: 'pending',
    signed_at: null,
    note: '',
  },
  {
    id: 'c3030303-3333-3333-3333-333333333333',
    document_id: 'b2020202-3333-3333-3333-333333333333',
    document_type: 'outgoing',
    approver_id: 'Trưởng phòng Tài vụ',
    order_no: 1,
    status: 'pending',
    signed_at: null,
    note: '',
  },
];

export const seedDistributions: DistributionItem[] = [
  {
    id: 'd4040404-1111-1111-1111-111111111111',
    document_id: 'a1010101-1111-1111-1111-111111111111',
    document_type: 'incoming',
    recipient_dept: 'Phòng Đào tạo',
    received_at: '2026-09-02T08:00:00.000Z',
    acknowledged_at: '2026-09-03T08:00:00.000Z',
  },
  {
    id: 'd4040404-2222-2222-2222-222222222222',
    document_id: 'a1010101-2222-2222-2222-222222222222',
    document_type: 'incoming',
    recipient_dept: 'Phòng Hành chính',
    received_at: '2026-09-05T08:00:00.000Z',
    acknowledged_at: null,
  },
];
