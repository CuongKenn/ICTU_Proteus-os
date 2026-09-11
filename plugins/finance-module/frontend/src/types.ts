// Finance Module — types map 1-1 với migrations/V1.0.0__initial.sql
// (finance_accounts, finance_transactions, finance_invoices,
//  finance_budgets, finance_expense_requests).

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export type TxnType = 'DEBIT' | 'CREDIT';

export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface FinanceAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parent_id: string | null;
}

export interface FinanceTransaction {
  id: string;
  transaction_date: string; // YYYY-MM-DD
  account_id: string;
  amount: number; // VND
  type: TxnType;
  category: string;
  description: string;
  proof_url: string;
}

export interface FinanceInvoice {
  id: string;
  invoice_number: string;
  vendor_name: string;
  amount: number; // VND
  issue_date: string; // YYYY-MM-DD
  due_date: string; // YYYY-MM-DD
  status: InvoiceStatus;
  file_url: string;
}

export interface FinanceBudget {
  id: string;
  department_id: string | null;
  project_id: string | null;
  month: string; // YYYY-MM
  category: string;
  allocated_amount: number; // VND
  spent_amount: number; // VND
}

export interface ExpenseRequest {
  id: string;
  requester_id: string; // UUID hr_employees ở live; tên hiển thị ở demo
  requester_name: string; // tên hiển thị (demo + UI; live map từ requester_id)
  amount: number; // VND
  category: string;
  reason: string;
  status: ExpenseStatus;
  approved_by: string | null;
  created_at: string; // ISO
}

export const TXN_TYPE_LABEL: Record<TxnType, string> = {
  DEBIT: 'Chi',
  CREDIT: 'Thu',
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  OVERDUE: 'Quá hạn',
  CANCELLED: 'Đã hủy',
};

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

export function formatVND(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}
