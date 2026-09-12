// Procurement Module — types map 1-1 với migrations/V1.0.0__initial.sql
// Lưu ý: cột `requester` (procurement_requests) là UUID → hr_employees ở DB
// thật; UI hiển thị `requester_name` (live map từ requester_id/requester).

export type RequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export type PoStatus = 'pending' | 'approved' | 'rejected' | 'delivered';

export interface Vendor {
  id: string;
  name: string;
  contact: string;
  rating: number; // 1..5
  tax_code: string;
  created_at: string; // ISO
}

export interface PurchaseRequest {
  id: string;
  requester_name: string;
  item_name: string;
  quantity: number;
  estimated_cost: number; // VND
  status: RequestStatus;
  created_at: string; // ISO
}

export interface Contract {
  id: string;
  vendor_id: string;
  value: number; // VND
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  status: ContractStatus;
  created_at: string; // ISO
}

export interface PurchaseOrder {
  id: string;
  contract_id: string;
  items_summary: string; // UI: tóm tắt từ items_json (JSONB)
  total_amount: number; // VND
  delivery_date: string; // YYYY-MM-DD
  status: PoStatus;
  created_at: string; // ISO
}

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  draft: 'Nháp',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: 'Nháp',
  active: 'Hiệu lực',
  expired: 'Hết hạn',
  terminated: 'Thanh lý',
};

export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  delivered: 'Đã nhận hàng',
};

export function formatVND(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}
