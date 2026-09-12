// Asset Module — types map 1-1 với migrations/V1.0.0__initial.sql

export type AssetStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'MAINTENANCE'
  | 'DISPOSED'
  | 'LOST';

export type MaintenanceType = 'ROUTINE' | 'REPAIR';

export type DisposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AssetCategory {
  id: string;
  code: string;
  name: string;
  description: string;
  depreciation_years: number;
}

export interface AssetItem {
  id: string;
  category_id: string;
  code: string;
  name: string;
  purchase_date: string; // YYYY-MM-DD
  purchase_price: number; // VND
  serial_no: string;
  status: AssetStatus;
  book_value_remaining: number; // VND
}

export interface AssetAssignment {
  id: string;
  asset_id: string;
  user_name: string;
  dept_name: string;
  assigned_at: string; // ISO
  returned_at: string | null;
  notes: string;
}

export interface MaintenanceLog {
  id: string;
  asset_id: string;
  type: MaintenanceType;
  technician: string;
  cost: number; // VND
  done_at: string; // ISO
  next_due: string; // YYYY-MM-DD
  notes: string;
}

export interface DisposalRequest {
  id: string;
  asset_id: string;
  requester: string;
  reason: string;
  estimated_value: number;
  status: DisposalStatus;
  created_at: string; // ISO
}

export const STATUS_LABEL: Record<AssetStatus, string> = {
  AVAILABLE: 'Sẵn sàng',
  ASSIGNED: 'Đang cấp phát',
  MAINTENANCE: 'Bảo trì',
  DISPOSED: 'Đã thanh lý',
  LOST: 'Thất lạc',
};

export function formatVND(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}
