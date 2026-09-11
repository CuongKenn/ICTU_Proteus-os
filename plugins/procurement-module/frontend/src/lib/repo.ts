// Procurement Module — DATA LAYER.
// Hai chế độ sau cùng 1 interface async ProcurementStore:
// - DEMO: createMockRepo (seed + localStorage, offline, không cần login).
// - LIVE: API thật (records CRUD + dispatcher → n8n), cần login ở Launchpad.
// getStore() tự dò: gọi thử API, rớt (401/offline/chưa cài) → DEMO + lý do.
import type {
  Contract,
  ContractStatus,
  PoStatus,
  PurchaseOrder,
  PurchaseRequest,
  RequestStatus,
  Vendor,
} from '../types';
import {
  seedContracts,
  seedPOs,
  seedRequests,
  seedVendors,
} from '../data/seed';

const LS_KEY = 'proteus:procurement-module:v1';

interface Persisted {
  requests: PurchaseRequest[];
  vendors: Vendor[];
  contracts: Contract[];
  pos: PurchaseOrder[];
}

function load(): Persisted {
  const fallback: Persisted = {
    requests: seedRequests,
    vendors: seedVendors,
    contracts: seedContracts,
    pos: seedPOs,
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      requests: parsed.requests ?? fallback.requests,
      vendors: parsed.vendors ?? fallback.vendors,
      contracts: parsed.contracts ?? fallback.contracts,
      pos: parsed.pos ?? fallback.pos,
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

export interface ProcurementRepo {
  listRequests(): PurchaseRequest[];
  createRequest(input: Omit<PurchaseRequest, 'id' | 'created_at'>): PurchaseRequest;
  reviewRequest(id: string, status: RequestStatus): void;
  listVendors(): Vendor[];
  createVendor(input: Omit<Vendor, 'id' | 'created_at'>): Vendor;
  rateVendor(id: string, rating: number): Vendor;
  removeVendor(id: string): void;
  listContracts(): Contract[];
  createContract(input: Omit<Contract, 'id' | 'created_at'>): Contract;
  updateContractStatus(id: string, status: ContractStatus): void;
  listPOs(): PurchaseOrder[];
  createPO(input: Omit<PurchaseOrder, 'id' | 'created_at'>): PurchaseOrder;
  reviewPO(id: string, status: PoStatus): void;
  reset(): void;
}

export function createMockRepo(): ProcurementRepo {
  return {
    listRequests: () => load().requests,
    createRequest(input) {
      const s = load();
      const row: PurchaseRequest = {
        ...input,
        id: uid(),
        created_at: new Date().toISOString(),
      };
      s.requests = [row, ...s.requests];
      save(s);
      return row;
    },
    reviewRequest(id, status) {
      const s = load();
      const req = s.requests.find((r) => r.id === id);
      if (!req) throw new Error('Không tìm thấy đề xuất');
      req.status = status;
      save(s);
    },
    listVendors: () => load().vendors,
    createVendor(input) {
      const s = load();
      const row: Vendor = { ...input, id: uid(), created_at: new Date().toISOString() };
      s.vendors = [row, ...s.vendors];
      save(s);
      return row;
    },
    rateVendor(id, rating) {
      const s = load();
      const v = s.vendors.find((x) => x.id === id);
      if (!v) throw new Error('Không tìm thấy nhà cung cấp');
      if (rating < 1 || rating > 5) throw new Error('Đánh giá phải từ 1 đến 5 sao');
      v.rating = rating;
      save(s);
      return v;
    },
    removeVendor(id) {
      const s = load();
      if (s.contracts.some((c) => c.vendor_id === id)) {
        throw new Error('Nhà cung cấp đang có hợp đồng, không thể xóa');
      }
      s.vendors = s.vendors.filter((v) => v.id !== id);
      save(s);
    },
    listContracts: () => load().contracts,
    createContract(input) {
      const s = load();
      const row: Contract = { ...input, id: uid(), created_at: new Date().toISOString() };
      s.contracts = [row, ...s.contracts];
      save(s);
      return row;
    },
    updateContractStatus(id, status) {
      const s = load();
      const c = s.contracts.find((x) => x.id === id);
      if (!c) throw new Error('Không tìm thấy hợp đồng');
      c.status = status;
      save(s);
    },
    listPOs: () => load().pos,
    createPO(input) {
      const s = load();
      const row: PurchaseOrder = { ...input, id: uid(), created_at: new Date().toISOString() };
      s.pos = [row, ...s.pos];
      save(s);
      return row;
    },
    reviewPO(id, status) {
      const s = load();
      const po = s.pos.find((p) => p.id === id);
      if (!po) throw new Error('Không tìm thấy PO');
      po.status = status;
      save(s);
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

export interface ProcurementStore {
  listRequests(): Promise<PurchaseRequest[]>;
  createRequest(input: Omit<PurchaseRequest, 'id' | 'created_at'>): Promise<PurchaseRequest>;
  reviewRequest(id: string, status: RequestStatus): Promise<void>;
  listVendors(): Promise<Vendor[]>;
  createVendor(input: Omit<Vendor, 'id' | 'created_at'>): Promise<Vendor>;
  rateVendor(id: string, rating: number): Promise<Vendor>;
  removeVendor(id: string): Promise<void>;
  listContracts(): Promise<Contract[]>;
  createContract(input: Omit<Contract, 'id' | 'created_at'>): Promise<Contract>;
  updateContractStatus(id: string, status: ContractStatus): Promise<void>;
  listPOs(): Promise<PurchaseOrder[]>;
  createPO(input: Omit<PurchaseOrder, 'id' | 'created_at'>): Promise<PurchaseOrder>;
  reviewPO(id: string, status: PoStatus): Promise<void>;
  reset(): Promise<void>;
}

const R = '/v1/plugins/procurement-module/records';

function toRequest(r: Record<string, unknown>): PurchaseRequest {
  return {
    id: String(r.id ?? ''),
    requester_name: String(r.requester_name ?? r.requester ?? ''),
    item_name: String(r.item_name ?? ''),
    quantity: Number(r.quantity ?? 1),
    estimated_cost: Number(r.estimated_cost ?? 0),
    status: (r.status as RequestStatus) ?? 'draft',
    created_at: String(r.created_at ?? ''),
  };
}

function toVendor(r: Record<string, unknown>): Vendor {
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    contact: String(r.contact ?? ''),
    rating: Number(r.rating ?? 3),
    tax_code: String(r.tax_code ?? ''),
    created_at: String(r.created_at ?? ''),
  };
}

function toContract(r: Record<string, unknown>): Contract {
  return {
    id: String(r.id ?? ''),
    vendor_id: String(r.vendor_id ?? ''),
    value: Number(r.value ?? 0),
    start_date: String(r.start_date ?? '').slice(0, 10),
    end_date: String(r.end_date ?? '').slice(0, 10),
    status: (r.status as ContractStatus) ?? 'active',
    created_at: String(r.created_at ?? ''),
  };
}

function toPO(r: Record<string, unknown>): PurchaseOrder {
  const items = r.items_json;
  return {
    id: String(r.id ?? ''),
    contract_id: String(r.contract_id ?? ''),
    items_summary:
      typeof items === 'string'
        ? items
        : items != null
          ? JSON.stringify(items)
          : '',
    total_amount: Number(r.total_amount ?? 0),
    delivery_date: String(r.delivery_date ?? '').slice(0, 10),
    status: (r.status as PoStatus) ?? 'pending',
    created_at: String(r.created_at ?? ''),
  };
}

/** Demo store: bọc mock sync thành async (giữ nguyên localStorage). */
export function createDemoStore(): ProcurementStore {
  const m = createMockRepo();
  return {
    async listRequests() { return m.listRequests(); },
    async createRequest(i) { return m.createRequest(i); },
    async reviewRequest(id, s) { m.reviewRequest(id, s); },
    async listVendors() { return m.listVendors(); },
    async createVendor(i) { return m.createVendor(i); },
    async rateVendor(id, r) { return m.rateVendor(id, r); },
    async removeVendor(id) { m.removeVendor(id); },
    async listContracts() { return m.listContracts(); },
    async createContract(i) { return m.createContract(i); },
    async updateContractStatus(id, s) { m.updateContractStatus(id, s); },
    async listPOs() { return m.listPOs(); },
    async createPO(i) { return m.createPO(i); },
    async reviewPO(id, s) { m.reviewPO(id, s); },
    async reset() { m.reset(); },
  };
}

/** Live store: records CRUD + dispatcher → n8n webhook. */
export function createLiveStore(client: BffClient): ProcurementStore {
  const rows = async <T>(table: string): Promise<T[]> => {
    const res = await client.get<{ rows: T[] }>(`${R}/${table}?limit=100`);
    return res.rows ?? [];
  };
  return {
    async listRequests() {
      return (await rows<Record<string, unknown>>('procurement_requests')).map(toRequest);
    },
    // Tạo đề xuất đi qua workflow wf_purchase_request (duyệt đề xuất mua hàng).
    async createRequest(i) {
      await client.post('/v1/plugins/procurement-module/actions/wf_purchase_request', {
        payload: {
          item_name: i.item_name,
          quantity: i.quantity,
          estimated_cost: i.estimated_cost,
          requester: i.requester_name,
        },
      });
      const all = await this.listRequests();
      const found = all.find((r) => r.item_name === i.item_name) ?? all[0];
      if (!found) throw new Error('Tạo đề xuất xong nhưng chưa thấy trong DB — tải lại sau giây lát.');
      return found;
    },
    async reviewRequest(id, status) {
      await client.patch(`${R}/procurement_requests/${id}`, { status });
    },
    async listVendors() {
      return (await rows<Record<string, unknown>>('procurement_vendors')).map(toVendor);
    },
    async createVendor(i) {
      return toVendor(await client.post(`${R}/procurement_vendors`, i));
    },
    async rateVendor(id, rating) {
      return toVendor(await client.patch(`${R}/procurement_vendors/${id}`, { rating }));
    },
    async removeVendor(id) {
      await client.del(`${R}/procurement_vendors/${id}`);
    },
    async listContracts() {
      return (await rows<Record<string, unknown>>('procurement_contracts')).map(toContract);
    },
    async createContract(i) {
      return toContract(await client.post(`${R}/procurement_contracts`, i));
    },
    async updateContractStatus(id, status) {
      await client.patch(`${R}/procurement_contracts/${id}`, { status });
    },
    async listPOs() {
      return (await rows<Record<string, unknown>>('procurement_purchase_orders')).map(toPO);
    },
    async createPO(i) {
      const row = await client.post<Record<string, unknown>>(
        `${R}/procurement_purchase_orders`,
        {
          contract_id: i.contract_id,
          items_json: i.items_summary,
          total_amount: i.total_amount,
          delivery_date: i.delivery_date || null,
        },
      );
      return toPO(row);
    },
    // Duyệt PO đi qua workflow wf_po_approval (202 → xử lý ngầm).
    async reviewPO(id, status) {
      await client.post('/v1/plugins/procurement-module/actions/wf_po_approval', {
        payload: { po_id: id, decision: status },
      });
      try {
        await client.patch(`${R}/procurement_purchase_orders/${id}`, { status });
      } catch { /* best-effort: workflow đã nhận, DB do n8n cập nhật */ }
    },
    async reset() { /* live: không reset DB từ UI */ },
  };
}

export interface ResolvedStore {
  mode: StoreMode;
  store: ProcurementStore;
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
        await client.get(`${R}/procurement_requests?limit=1`);
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
