// Finance Module — DATA LAYER.
// Hai chế độ sau cùng 1 interface async FinanceStore:
// - DEMO: createMockRepo (seed + localStorage, offline, không cần login).
// - LIVE: API thật (records CRUD + dispatcher → n8n), cần login ở Launchpad.
// getStore() tự dò: gọi thử API, rớt (401/offline/chưa cài) → DEMO + lý do.
// QUY TẮC: mọi gọi API qua BffClient tới /api/proxy, KHÔNG bao giờ gửi mã
// định danh tenant (tenant suy ra từ session ở BFF/dispatcher).
import type {
  ExpenseRequest,
  ExpenseStatus,
  FinanceAccount,
  FinanceBudget,
  FinanceInvoice,
  FinanceTransaction,
  InvoiceStatus,
} from '../types';
import {
  seedAccounts,
  seedBudgets,
  seedExpenses,
  seedInvoices,
  seedTransactions,
} from '../data/seed';

const LS_KEY = 'proteus:finance-module:v1';

interface Persisted {
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  invoices: FinanceInvoice[];
  expenses: ExpenseRequest[];
  budgets: FinanceBudget[];
}

function load(): Persisted {
  const fallback: Persisted = {
    accounts: seedAccounts,
    transactions: seedTransactions,
    invoices: seedInvoices,
    expenses: seedExpenses,
    budgets: seedBudgets,
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      accounts: parsed.accounts ?? fallback.accounts,
      transactions: parsed.transactions ?? fallback.transactions,
      invoices: parsed.invoices ?? fallback.invoices,
      expenses: parsed.expenses ?? fallback.expenses,
      budgets: parsed.budgets ?? fallback.budgets,
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

export interface FinanceRepo {
  listAccounts(): FinanceAccount[];
  listTransactions(): FinanceTransaction[];
  createTransaction(input: Omit<FinanceTransaction, 'id'>): FinanceTransaction;
  updateTransaction(id: string, patch: Partial<FinanceTransaction>): FinanceTransaction;
  removeTransaction(id: string): void;
  listInvoices(): FinanceInvoice[];
  createInvoice(input: Omit<FinanceInvoice, 'id'>): FinanceInvoice;
  reviewInvoice(id: string, status: InvoiceStatus): void;
  removeInvoice(id: string): void;
  listExpenses(): ExpenseRequest[];
  createExpense(input: Omit<ExpenseRequest, 'id' | 'status' | 'created_at' | 'approved_by'>): ExpenseRequest;
  reviewExpense(id: string, status: ExpenseStatus): void;
  listBudgets(): FinanceBudget[];
  reset(): void;
}

export function createMockRepo(): FinanceRepo {
  return {
    listAccounts: () => load().accounts,
    listTransactions: () => load().transactions,
    createTransaction(input) {
      const s = load();
      const row = { ...input, id: uid() };
      s.transactions = [row, ...s.transactions];
      save(s);
      return row;
    },
    updateTransaction(id, patch) {
      const s = load();
      const row = s.transactions.find((t) => t.id === id);
      if (!row) throw new Error('Không tìm thấy giao dịch');
      Object.assign(row, patch);
      save(s);
      return row;
    },
    removeTransaction(id) {
      const s = load();
      s.transactions = s.transactions.filter((t) => t.id !== id);
      save(s);
    },
    listInvoices: () => load().invoices,
    createInvoice(input) {
      const s = load();
      const row = { ...input, id: uid() };
      s.invoices = [row, ...s.invoices];
      save(s);
      return row;
    },
    reviewInvoice(id, status) {
      const s = load();
      const row = s.invoices.find((i) => i.id === id);
      if (!row) throw new Error('Không tìm thấy hóa đơn');
      row.status = status;
      save(s);
    },
    removeInvoice(id) {
      const s = load();
      s.invoices = s.invoices.filter((i) => i.id !== id);
      save(s);
    },
    listExpenses: () => load().expenses,
    createExpense(input) {
      const s = load();
      const row: ExpenseRequest = {
        ...input,
        id: uid(),
        status: 'PENDING',
        approved_by: null,
        created_at: new Date().toISOString(),
      };
      s.expenses = [row, ...s.expenses];
      save(s);
      return row;
    },
    reviewExpense(id, status) {
      const s = load();
      const row = s.expenses.find((e) => e.id === id);
      if (!row) throw new Error('Không tìm thấy đề xuất');
      row.status = status;
      save(s);
    },
    listBudgets: () => load().budgets,
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

export interface FinanceStore {
  listAccounts(): Promise<FinanceAccount[]>;
  listTransactions(): Promise<FinanceTransaction[]>;
  createTransaction(input: Omit<FinanceTransaction, 'id'>): Promise<FinanceTransaction>;
  updateTransaction(id: string, patch: Partial<FinanceTransaction>): Promise<FinanceTransaction>;
  removeTransaction(id: string): Promise<void>;
  listInvoices(): Promise<FinanceInvoice[]>;
  createInvoice(input: Omit<FinanceInvoice, 'id'>): Promise<void>;
  reviewInvoice(id: string, status: InvoiceStatus): Promise<void>;
  removeInvoice(id: string): Promise<void>;
  listExpenses(): Promise<ExpenseRequest[]>;
  createExpense(input: Omit<ExpenseRequest, 'id' | 'status' | 'created_at' | 'approved_by'>): Promise<void>;
  reviewExpense(id: string, status: ExpenseStatus): Promise<void>;
  listBudgets(): Promise<FinanceBudget[]>;
  reset(): Promise<void>;
}

const R = '/v1/plugins/finance-module/records';

function toTransaction(r: Record<string, unknown>): FinanceTransaction {
  return {
    id: String(r.id ?? ''),
    transaction_date: String(r.transaction_date ?? '').slice(0, 10),
    account_id: String(r.account_id ?? ''),
    amount: Number(r.amount ?? 0),
    type: (r.type as FinanceTransaction['type']) ?? 'DEBIT',
    category: String(r.category ?? ''),
    description: String(r.description ?? ''),
    proof_url: String(r.proof_url ?? ''),
  };
}

function toInvoice(r: Record<string, unknown>): FinanceInvoice {
  return {
    id: String(r.id ?? ''),
    invoice_number: String(r.invoice_number ?? ''),
    vendor_name: String(r.vendor_name ?? ''),
    amount: Number(r.amount ?? 0),
    issue_date: String(r.issue_date ?? '').slice(0, 10),
    due_date: String(r.due_date ?? '').slice(0, 10),
    status: (r.status as InvoiceStatus) ?? 'PENDING',
    file_url: String(r.file_url ?? ''),
  };
}

function toExpense(r: Record<string, unknown>): ExpenseRequest {
  const requester = String(r.requester_name ?? r.requester_id ?? '');
  return {
    id: String(r.id ?? ''),
    requester_id: String(r.requester_id ?? requester),
    requester_name: requester,
    amount: Number(r.amount ?? 0),
    category: String(r.category ?? ''),
    reason: String(r.reason ?? r.description ?? ''),
    status: (r.status as ExpenseStatus) ?? 'PENDING',
    approved_by: r.approved_by == null ? null : String(r.approved_by),
    created_at: String(r.created_at ?? ''),
  };
}

/** Demo store: bọc mock sync thành async (giữ nguyên localStorage). */
export function createDemoStore(): FinanceStore {
  const m = createMockRepo();
  return {
    async listAccounts() { return m.listAccounts(); },
    async listTransactions() { return m.listTransactions(); },
    async createTransaction(i) { return m.createTransaction(i); },
    async updateTransaction(id, p) { return m.updateTransaction(id, p); },
    async removeTransaction(id) { m.removeTransaction(id); },
    async listInvoices() { return m.listInvoices(); },
    async createInvoice(i) { m.createInvoice(i); },
    async reviewInvoice(id, s) { m.reviewInvoice(id, s); },
    async removeInvoice(id) { m.removeInvoice(id); },
    async listExpenses() { return m.listExpenses(); },
    async createExpense(i) { m.createExpense(i); },
    async reviewExpense(id, s) { m.reviewExpense(id, s); },
    async listBudgets() { return m.listBudgets(); },
    async reset() { m.reset(); },
  };
}

/** Live store: records CRUD + dispatcher → n8n webhook. */
export function createLiveStore(client: BffClient): FinanceStore {
  const rows = async <T>(table: string): Promise<T[]> => {
    const res = await client.get<{ rows: T[] }>(`${R}/${table}?limit=100`);
    return res.rows ?? [];
  };
  return {
    async listAccounts() {
      return rows<FinanceAccount>('finance_accounts');
    },
    async listTransactions() {
      return (await rows<Record<string, unknown>>('finance_transactions')).map(toTransaction);
    },
    async createTransaction(i) {
      return toTransaction(await client.post(`${R}/finance_transactions`, i));
    },
    async updateTransaction(id, p) {
      return toTransaction(await client.patch(`${R}/finance_transactions/${id}`, p));
    },
    async removeTransaction(id) {
      await client.del(`${R}/finance_transactions/${id}`);
    },
    async listInvoices() {
      return (await rows<Record<string, unknown>>('finance_invoices')).map(toInvoice);
    },
    // Tạo hóa đơn đi qua workflow wf_invoice_processing (ghi DB + nhắn kế toán).
    async createInvoice(i) {
      await client.post('/v1/plugins/finance-module/actions/wf_invoice_processing', {
        payload: {
          invoice_number: i.invoice_number,
          vendor_name: i.vendor_name,
          amount: i.amount,
          issue_date: i.issue_date,
          due_date: i.due_date,
        },
      });
    },
    async reviewInvoice(id, status) {
      await client.patch(`${R}/finance_invoices/${id}`, { status });
    },
    async removeInvoice(id) {
      await client.del(`${R}/finance_invoices/${id}`);
    },
    async listExpenses() {
      return (await rows<Record<string, unknown>>('finance_expense_requests')).map(toExpense);
    },
    // Tạo đề xuất chi đi qua workflow wf_expense_approval (ghi DB + nhắn người duyệt).
    async createExpense(i) {
      await client.post('/v1/plugins/finance-module/actions/wf_expense_approval', {
        payload: {
          requester_id: i.requester_id,
          amount: i.amount,
          category: i.category,
          description: i.reason,
        },
      });
    },
    async reviewExpense(id, status) {
      await client.patch(`${R}/finance_expense_requests/${id}`, { status });
    },
    async listBudgets() {
      return rows<FinanceBudget>('finance_budgets');
    },
    async reset() { /* live: không reset DB từ UI */ },
  };
}

export interface ResolvedStore {
  mode: StoreMode;
  store: FinanceStore;
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
        await client.get(`${R}/finance_transactions?limit=1`);
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
