// Document Module — types map 1-1 với migrations/V1.0.0__initial.sql
// (document_categories, document_incoming, document_outgoing,
//  document_approvals, document_distributions).
// UUID tham chiếu nhân sự (assignee_id, nguoi_ky, approver_id) ở DEMO
// hiển thị bằng tên tiếng Việt; LIVE gửi UUID thật qua dispatcher/records.

export type IncomingStatus = 'received' | 'processing' | 'done';
export type OutgoingStatus = 'draft' | 'pending' | 'signed' | 'published';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalDocType = 'outgoing' | 'internal';

export interface DocumentCategory {
  id: string;
  name: string;
  description: string;
}

export interface IncomingDoc {
  id: string;
  so_van_ban: string;
  noi_gui: string;
  ngay_nhan: string; // YYYY-MM-DD
  trich_yeu: string;
  file_url: string;
  assignee_id: string | null; // UUID (LIVE) hoặc tên hiển thị (DEMO)
  status: IncomingStatus;
}

export interface OutgoingDoc {
  id: string;
  so_van_ban: string;
  loai_vb: string; // FK → document_categories.id
  nguoi_ky: string | null; // UUID (LIVE) hoặc tên hiển thị (DEMO)
  ngay_phat_hanh: string; // YYYY-MM-DD
  file_url: string;
  status: OutgoingStatus;
  // Helper chỉ dùng ở DEMO để hiển thị (bảng gốc không có cột này).
  tieu_de?: string;
}

export interface ApprovalItem {
  id: string;
  document_id: string;
  document_type: ApprovalDocType;
  approver_id: string; // UUID (LIVE) hoặc tên hiển thị (DEMO)
  order_no: number;
  status: ApprovalStatus;
  signed_at: string | null; // ISO
  note: string;
}

export interface DistributionItem {
  id: string;
  document_id: string;
  document_type: string; // 'incoming' | 'outgoing' | 'internal'
  recipient_dept: string;
  received_at: string; // ISO
  acknowledged_at: string | null; // ISO
}

export const INCOMING_LABEL: Record<IncomingStatus, string> = {
  received: 'Mới tiếp nhận',
  processing: 'Đang xử lý',
  done: 'Hoàn tất',
};

export const OUTGOING_LABEL: Record<OutgoingStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ ký',
  signed: 'Đã ký',
  published: 'Đã ban hành',
};

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};
