// Asset Module — DATA LAYER.
// Hai chế độ sau cùng 1 interface async AssetStore:
// - DEMO: createMockRepo (seed + localStorage, offline, không cần login).
// - LIVE: API thật (records CRUD + dispatcher → n8n), cần login ở Launchpad.
// getStore() tự dò: gọi thử API, rớt (401/offline/chưa cài) → DEMO + lý do.
import type {
  AssetAssignment,
  AssetItem,
  AssetStatus,
  DisposalRequest,
  DisposalStatus,
  MaintenanceLog,
} from '../types';
import {
  seedAssignments,
  seedDisposals,
  seedItems,
  seedMaintenance,
} from '../data/seed';

const LS_KEY = 'proteus:asset-module:v1';

interface Persisted {
  items: AssetItem[];
  assignments: AssetAssignment[];
  maintenance: MaintenanceLog[];
  disposals: DisposalRequest[];
}

function load(): Persisted {
  const fallback: Persisted = {
    items: seedItems,
    assignments: seedAssignments,
    maintenance: seedMaintenance,
    disposals: seedDisposals,
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      items: parsed.items ?? fallback.items,
      assignments: parsed.assignments ?? fallback.assignments,
      maintenance: parsed.maintenance ?? fallback.maintenance,
      disposals: parsed.disposals ?? fallback.disposals,
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

export interface AssetRepo {
  listItems(): AssetItem[];
  createItem(input: Omit<AssetItem, 'id'>): AssetItem;
  updateItem(id: string, patch: Partial<AssetItem>): AssetItem;
  removeItem(id: string): void;
  assignAsset(asset_id: string, user_name: string, dept_name: string, notes: string): void;
  returnAsset(asset_id: string): void;
  listAssignments(asset_id?: string): AssetAssignment[];
  listMaintenance(asset_id?: string): MaintenanceLog[];
  addMaintenance(log: Omit<MaintenanceLog, 'id'>): MaintenanceLog;
  listDisposals(): DisposalRequest[];
  createDisposal(input: Omit<DisposalRequest, 'id' | 'status' | 'created_at'>): DisposalRequest;
  reviewDisposal(id: string, status: DisposalStatus): void;
  reset(): void;
}

export function createMockRepo(): AssetRepo {
  return {
    listItems: () => load().items,
    createItem(input) {
      const s = load();
      const item = { ...input, id: uid() };
      s.items = [item, ...s.items];
      save(s);
      return item;
    },
    updateItem(id, patch) {
      const s = load();
      const item = s.items.find((i) => i.id === id);
      if (!item) throw new Error('Không tìm thấy tài sản');
      Object.assign(item, patch);
      save(s);
      return item;
    },
    removeItem(id) {
      const s = load();
      s.items = s.items.filter((i) => i.id !== id);
      save(s);
    },
    assignAsset(asset_id, user_name, dept_name, notes) {
      const s = load();
      const item = s.items.find((i) => i.id === asset_id);
      if (!item) throw new Error('Không tìm thấy tài sản');
      if (item.status !== 'AVAILABLE') throw new Error('Tài sản không ở trạng thái sẵn sàng');
      item.status = 'ASSIGNED' as AssetStatus;
      s.assignments = [
        {
          id: uid(),
          asset_id,
          user_name,
          dept_name,
          assigned_at: new Date().toISOString(),
          returned_at: null,
          notes,
        },
        ...s.assignments,
      ];
      save(s);
    },
    returnAsset(asset_id) {
      const s = load();
      const item = s.items.find((i) => i.id === asset_id);
      if (!item) throw new Error('Không tìm thấy tài sản');
      item.status = 'AVAILABLE';
      const open = s.assignments.find(
        (a) => a.asset_id === asset_id && a.returned_at === null,
      );
      if (open) open.returned_at = new Date().toISOString();
      save(s);
    },
    listAssignments: (asset_id) => {
      const all = load().assignments;
      return asset_id ? all.filter((a) => a.asset_id === asset_id) : all;
    },
    listMaintenance: (asset_id) => {
      const all = load().maintenance;
      return asset_id ? all.filter((m) => m.asset_id === asset_id) : all;
    },
    addMaintenance(log) {
      const s = load();
      const row = { ...log, id: uid() };
      s.maintenance = [row, ...s.maintenance];
      const item = s.items.find((i) => i.id === log.asset_id);
      if (item && item.status === 'AVAILABLE') item.status = 'MAINTENANCE';
      save(s);
      return row;
    },
    listDisposals: () => load().disposals,
    createDisposal(input) {
      const s = load();
      const row: DisposalRequest = {
        ...input,
        id: uid(),
        status: 'PENDING',
        created_at: new Date().toISOString(),
      };
      s.disposals = [row, ...s.disposals];
      save(s);
      return row;
    },
    reviewDisposal(id, status) {
      const s = load();
      const req = s.disposals.find((d) => d.id === id);
      if (!req) throw new Error('Không tìm thấy đề xuất');
      req.status = status;
      if (status === 'APPROVED') {
        const item = s.items.find((i) => i.id === req.asset_id);
        if (item) {
          item.status = 'DISPOSED';
          item.book_value_remaining = 0;
        }
      }
      save(s);
    },
    reset() {
      localStorage.removeItem(LS_KEY);
    },
  };
}

// ─── Async Store (DEMO + LIVE chung interface) ──────────────
import { ApiError, createBffClient, type BffClient } from './api';
import { seedCategories } from '../data/seed';

export type StoreMode = 'live' | 'demo';
export type DemoReason =
  | 'unauthenticated' // 401: chưa login ở Launchpad
  | 'not-installed' // plugin chưa ACTIVE / bảng chưa có
  | 'offline'; // không tới được BFF

export interface AssetStore {
  listItems(): Promise<AssetItem[]>;
  listCategories(): Promise<{ id: string; name: string; code: string }[]>;
  createItem(input: Omit<AssetItem, 'id'>): Promise<AssetItem>;
  updateItem(id: string, patch: Partial<AssetItem>): Promise<AssetItem>;
  removeItem(id: string): Promise<void>;
  assignAsset(
    asset_id: string, user_name: string, dept_name: string, notes: string,
  ): Promise<void>;
  returnAsset(asset_id: string): Promise<void>;
  listAssignments(asset_id?: string): Promise<AssetAssignment[]>;
  listMaintenance(asset_id?: string): Promise<MaintenanceLog[]>;
  addMaintenance(log: Omit<MaintenanceLog, 'id'>): Promise<MaintenanceLog>;
  listDisposals(): Promise<DisposalRequest[]>;
  createDisposal(
    input: Omit<DisposalRequest, 'id' | 'status' | 'created_at'>,
  ): Promise<DisposalRequest>;
  reviewDisposal(id: string, status: DisposalStatus): Promise<void>;
  reset(): Promise<void>;
}

const R = '/v1/plugins/asset-module/records';

function toItem(r: Record<string, unknown>): AssetItem {
  return {
    id: String(r.id ?? ''),
    category_id: String(r.category_id ?? ''),
    code: String(r.code ?? ''),
    name: String(r.name ?? ''),
    purchase_date: String(r.purchase_date ?? '').slice(0, 10),
    purchase_price: Number(r.purchase_price ?? 0),
    serial_no: String(r.serial_no ?? ''),
    status: (r.status as AssetStatus) ?? 'AVAILABLE',
    book_value_remaining: Number(r.book_value_remaining ?? 0),
  };
}

function toDisposal(r: Record<string, unknown>): DisposalRequest {
  return {
    id: String(r.id ?? ''),
    asset_id: String(r.asset_id ?? ''),
    requester: String(r.requester_name ?? r.requester ?? ''),
    reason: String(r.reason ?? ''),
    estimated_value: Number(r.estimated_value ?? 0),
    status: (r.status as DisposalStatus) ?? 'PENDING',
    created_at: String(r.created_at ?? ''),
  };
}

/** Demo store: bọc mock sync thành async (giữ nguyên localStorage). */
export function createDemoStore(): AssetStore {
  const m = createMockRepo();
  const items = () => m.listItems();
  return {
    async listItems() { return items(); },
    async listCategories() { return seedCategories; },
    async createItem(i) { return m.createItem(i); },
    async updateItem(id, p) { return m.updateItem(id, p); },
    async removeItem(id) { m.removeItem(id); },
    async assignAsset(a, u, d, n) { m.assignAsset(a, u, d, n); },
    async returnAsset(id) { m.returnAsset(id); },
    async listAssignments(a) { return m.listAssignments(a); },
    async listMaintenance(a) { return m.listMaintenance(a); },
    async addMaintenance(l) { return m.addMaintenance(l); },
    async listDisposals() { return m.listDisposals(); },
    async createDisposal(i) { return m.createDisposal(i); },
    async reviewDisposal(id, s) { m.reviewDisposal(id, s); },
    async reset() { m.reset(); },
  };
}

/** Live store: records CRUD + dispatcher → n8n webhook. */
export function createLiveStore(client: BffClient): AssetStore {
  const rows = async <T>(table: string): Promise<T[]> => {
    const res = await client.get<{ rows: T[] }>(`${R}/${table}?limit=100`);
    return res.rows ?? [];
  };
  return {
    async listItems() {
      return (await rows<Record<string, unknown>>('asset_items')).map(toItem);
    },
    async listCategories() {
      try {
        const cats = await rows<Record<string, unknown>>('asset_categories');
        return cats.map((c) => ({
          id: String(c.id), name: String(c.name), code: String(c.code),
        }));
      } catch {
        return seedCategories;
      }
    },
    async createItem(i) {
      return toItem(await client.post(`${R}/asset_items`, i));
    },
    async updateItem(id, p) {
      return toItem(await client.patch(`${R}/asset_items/${id}`, p));
    },
    async removeItem(id) {
      await client.del(`${R}/asset_items/${id}`);
    },
    // Cấp phát đi qua workflow wf_asset_request (check tồn → gán → nhắn IT).
    async assignAsset(asset_id, user_name, dept_name, notes) {
      const items = await this.listItems();
      const item = items.find((i) => i.id === asset_id);
      await client.post('/v1/plugins/asset-module/actions/wf_asset_request', {
        payload: {
          asset_id,
          asset_type: item?.code.split('-')[0] ?? item?.code ?? '',
          requester_id: user_name,
          description: notes || `Cấp phát ${item?.code ?? asset_id} cho ${user_name} (${dept_name})`,
          priority: 'P3',
        },
      });
    },
    async returnAsset(asset_id) {
      await client.patch(`${R}/asset_items/${asset_id}`, { status: 'AVAILABLE' });
      const all = await rows<AssetAssignment>('asset_assignments');
      const open = all.find((a) => a.asset_id === asset_id && !a.returned_at);
      if (open) {
        await client.patch(`${R}/asset_assignments/${open.id}`, {
          returned_at: new Date().toISOString(),
        });
      }
    },
    async listAssignments(asset_id) {
      const all = await rows<AssetAssignment>('asset_assignments');
      return asset_id ? all.filter((a) => a.asset_id === asset_id) : all;
    },
    async listMaintenance(asset_id) {
      const all = await rows<MaintenanceLog>('asset_maintenance_logs');
      return asset_id ? all.filter((m) => m.asset_id === asset_id) : all;
    },
    async addMaintenance(log) {
      const row = await client.post<Record<string, unknown>>(
        `${R}/asset_maintenance_logs`, log,
      );
      try {
        const items = await this.listItems();
        const item = items.find((i) => i.id === log.asset_id);
        if (item?.status === 'AVAILABLE') {
          await client.patch(`${R}/asset_items/${log.asset_id}`, {
            status: 'MAINTENANCE',
          });
        }
      } catch { /* best-effort */ }
      return row as unknown as MaintenanceLog;
    },
    async listDisposals() {
      return (await rows<Record<string, unknown>>('asset_disposal_requests')).map(toDisposal);
    },
    async createDisposal(i) {
      const row = await client.post<Record<string, unknown>>(
        `${R}/asset_disposal_requests`,
        {
          asset_id: i.asset_id,
          requester_name: i.requester,
          reason: i.reason,
          estimated_value: i.estimated_value,
        },
      );
      return toDisposal(row);
    },
    async reviewDisposal(id, status) {
      await client.patch(`${R}/asset_disposal_requests/${id}`, { status });
      if (status === 'APPROVED') {
        const all = await this.listDisposals();
        const req = all.find((d) => d.id === id);
        if (req) {
          await client.patch(`${R}/asset_items/${req.asset_id}`, {
            status: 'DISPOSED',
            book_value_remaining: 0,
          });
        }
      }
    },
    async reset() { /* live: không reset DB từ UI */ },
  };
}

export interface ResolvedStore {
  mode: StoreMode;
  store: AssetStore;
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
        await client.get(`${R}/asset_items?limit=1`);
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
