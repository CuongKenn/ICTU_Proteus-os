// Document Module — DATA LAYER.
// Hai chế độ sau cùng 1 interface async DocumentStore:
// - DEMO: mock sync (seed + localStorage, offline, không cần login).
// - LIVE: API thật (records CRUD + dispatcher → n8n), cần login ở Launchpad.
// getStore() tự dò: gọi thử API, rớt (401/offline/chưa cài) → DEMO + lý do.
// Mọi gọi API qua BffClient tới /api/proxy; KHÔNG BAO GIỜ gửi tenant_id.
import type {
  ApprovalItem,
  ApprovalStatus,
  DistributionItem,
  DocumentCategory,
  IncomingDoc,
  IncomingStatus,
  OutgoingDoc,
} from '../types';
import {
  seedApprovals,
  seedCategories,
  seedDistributions,
  seedIncoming,
  seedOutgoing,
} from '../data/seed';

const LS_KEY = 'proteus:document-module:v1';

interface Persisted {
  incoming: IncomingDoc[];
  outgoing: OutgoingDoc[];
  approvals: ApprovalItem[];
  distributions: DistributionItem[];
}

function load(): Persisted {
  const fallback: Persisted = {
    incoming: seedIncoming,
    outgoing: seedOutgoing,
    approvals: seedApprovals,
    distributions: seedDistributions,
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      incoming: parsed.incoming ?? fallback.incoming,
      outgoing: parsed.outgoing ?? fallback.outgoing,
      approvals: parsed.approvals ?? fallback.approvals,
      distributions: parsed.distributions ?? fallback.distributions,
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

export interface DocumentRepo {
  listIncoming(): IncomingDoc[];
  createIncoming(input: Omit<IncomingDoc, 'id' | 'status'>): IncomingDoc;
  updateIncoming(id: string, patch: Partial<IncomingDoc>): IncomingDoc;
  reassignIncoming(id: string, assignee: string): void;
  listOutgoing(): OutgoingDoc[];
  createOutgoing(input: Omit<OutgoingDoc, 'id'>): OutgoingDoc;
  updateOutgoing(id: string, patch: Partial<OutgoingDoc>): OutgoingDoc;
  listApprovals(): ApprovalItem[];
  reviewApproval(id: string, status: ApprovalStatus, note: string): void;
  listDistributions(): DistributionItem[];
  reset(): void;
}

export function createMockRepo(): DocumentRepo {
  return {
    listIncoming: () => load().incoming,
    createIncoming(input) {
      const s = load();
      const row: IncomingDoc = { ...input, id: uid(), status: 'received' };
      s.incoming = [row, ...s.incoming];
      save(s);
      return row;
    },
    updateIncoming(id, patch) {
      const s = load();
      const row = s.incoming.find((d) => d.id === id);
      if (!row) throw new Error('Không tìm thấy văn bản đến');
      Object.assign(row, patch);
      save(s);
      return row;
    },
    reassignIncoming(id, assignee) {
      const s = load();
      const row = s.incoming.find((d) => d.id === id);
      if (!row) throw new Error('Không tìm thấy văn bản đến');
      row.assignee_id = assignee;
      if (row.status === 'received') row.status = 'processing' as IncomingStatus;
      save(s);
    },
    listOutgoing: () => load().outgoing,
    createOutgoing(input) {
      const s = load();
      const row: OutgoingDoc = { ...input, id: uid() };
      s.outgoing = [row, ...s.outgoing];
      save(s);
      return row;
    },
    updateOutgoing(id, patch) {
      const s = load();
      const row = s.outgoing.find((d) => d.id === id);
      if (!row) throw new Error('Không tìm thấy văn bản đi');
      Object.assign(row, patch);
      save(s);
      return row;
    },
    listApprovals: () => load().approvals,
    reviewApproval(id, status, note) {
      const s = load();
      const req = s.approvals.find((a) => a.id === id);
      if (!req) throw new Error('Không tìm thấy yêu cầu phê duyệt');
      req.status = status;
      req.note = note;
      req.signed_at = status === 'pending' ? null : new Date().toISOString();
      save(s);
    },
    listDistributions: () => load().distributions,
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

export interface DocumentStore {
  listCategories(): Promise<DocumentCategory[]>;
  listIncoming(): Promise<IncomingDoc[]>;
  createIncoming(input: Omit<IncomingDoc, 'id' | 'status'>): Promise<IncomingDoc>;
  updateIncoming(id: string, patch: Partial<IncomingDoc>): Promise<IncomingDoc>;
  reassignIncoming(id: string, assignee: string): Promise<void>;
  listOutgoing(): Promise<OutgoingDoc[]>;
  createOutgoing(input: Omit<OutgoingDoc, 'id'>): Promise<OutgoingDoc>;
  updateOutgoing(id: string, patch: Partial<OutgoingDoc>): Promise<OutgoingDoc>;
  listApprovals(document_id?: string): Promise<ApprovalItem[]>;
  reviewApproval(id: string, status: ApprovalStatus, note: string): Promise<void>;
  listDistributions(): Promise<DistributionItem[]>;
  reset(): Promise<void>;
}

const R = '/v1/plugins/document-module/records';
const A = '/v1/plugins/document-module/actions';

function toIncoming(r: Record<string, unknown>): IncomingDoc {
  return {
    id: String(r.id ?? ''),
    so_van_ban: String(r.so_van_ban ?? ''),
    noi_gui: String(r.noi_gui ?? ''),
    ngay_nhan: String(r.ngay_nhan ?? '').slice(0, 10),
    trich_yeu: String(r.trich_yeu ?? ''),
    file_url: String(r.file_url ?? ''),
    assignee_id: r.assignee_id == null ? null : String(r.assignee_id),
    status: (r.status as IncomingStatus) ?? 'received',
  };
}

function toOutgoing(r: Record<string, unknown>): OutgoingDoc {
  return {
    id: String(r.id ?? ''),
    so_van_ban: String(r.so_van_ban ?? ''),
    loai_vb: String(r.loai_vb ?? ''),
    nguoi_ky: r.nguoi_ky == null ? null : String(r.nguoi_ky),
    ngay_phat_hanh: String(r.ngay_phat_hanh ?? '').slice(0, 10),
    file_url: String(r.file_url ?? ''),
    status: (r.status as OutgoingDoc['status']) ?? 'draft',
  };
}

function toApproval(r: Record<string, unknown>): ApprovalItem {
  return {
    id: String(r.id ?? ''),
    document_id: String(r.document_id ?? ''),
    document_type: (r.document_type as ApprovalItem['document_type']) ?? 'outgoing',
    approver_id: String(r.approver_id ?? ''),
    order_no: Number(r.order_no ?? 0),
    status: (r.status as ApprovalStatus) ?? 'pending',
    signed_at: r.signed_at == null ? null : String(r.signed_at),
    note: String(r.note ?? ''),
  };
}

/** Demo store: bọc mock sync thành async (giữ nguyên localStorage). */
export function createDemoStore(): DocumentStore {
  const m = createMockRepo();
  return {
    async listCategories() { return seedCategories; },
    async listIncoming() { return m.listIncoming(); },
    async createIncoming(i) { return m.createIncoming(i); },
    async updateIncoming(id, p) { return m.updateIncoming(id, p); },
    async reassignIncoming(id, a) { m.reassignIncoming(id, a); },
    async listOutgoing() { return m.listOutgoing(); },
    async createOutgoing(i) { return m.createOutgoing(i); },
    async updateOutgoing(id, p) { return m.updateOutgoing(id, p); },
    async listApprovals(doc) {
      const all = m.listApprovals();
      return doc ? all.filter((a) => a.document_id === doc) : all;
    },
    async reviewApproval(id, s, n) { m.reviewApproval(id, s, n); },
    async listDistributions() { return m.listDistributions(); },
    async reset() { m.reset(); },
  };
}

/** Live store: records CRUD + dispatcher → n8n webhook. */
export function createLiveStore(client: BffClient): DocumentStore {
  const rows = async <T>(table: string): Promise<T[]> => {
    const res = await client.get<{ rows: T[] }>(`${R}/${table}?limit=100`);
    return res.rows ?? [];
  };
  return {
    async listCategories() {
      try {
        const cats = await rows<Record<string, unknown>>('document_categories');
        return cats.map((c) => ({
          id: String(c.id),
          name: String(c.name),
          description: String(c.description ?? ''),
        }));
      } catch {
        return seedCategories;
      }
    },
    async listIncoming() {
      return (await rows<Record<string, unknown>>('document_incoming')).map(toIncoming);
    },
    // Tạo văn bản đến đi qua workflow wf_incoming_document (tiếp nhận → phân phối).
    async createIncoming(i) {
      const row = await client.post<Record<string, unknown>>(
        `${A}/wf_incoming_document`,
        {
          payload: {
            so_van_ban: i.so_van_ban,
            noi_gui: i.noi_gui,
            ngay_nhan: i.ngay_nhan,
            trich_yeu: i.trich_yeu,
            file_url: i.file_url || undefined,
            assignee_id: i.assignee_id || undefined,
          },
        },
      );
      return toIncoming(row);
    },
    async updateIncoming(id, p) {
      return toIncoming(await client.patch(`${R}/document_incoming/${id}`, p));
    },
    // Điều chuyển văn bản đi qua workflow wf_reassign_document.
    async reassignIncoming(id, assignee) {
      await client.post(`${A}/wf_reassign_document`, {
        payload: { document_id: id, assignee_id: assignee },
      });
    },
    async listOutgoing() {
      return (await rows<Record<string, unknown>>('document_outgoing')).map(toOutgoing);
    },
    async createOutgoing(i) {
      const { tieu_de: _t, ...body } = i;
      return toOutgoing(await client.post(`${R}/document_outgoing`, body));
    },
    async updateOutgoing(id, p) {
      const { tieu_de: _t, ...body } = p;
      return toOutgoing(await client.patch(`${R}/document_outgoing/${id}`, body));
    },
    async listApprovals(document_id) {
      const all = (await rows<Record<string, unknown>>('document_approvals')).map(toApproval);
      return document_id ? all.filter((a) => a.document_id === document_id) : all;
    },
    // Duyệt văn bản đi qua workflow wf_document_approval (ký tuần tự).
    async reviewApproval(id, status, note) {
      await client.post(`${A}/wf_document_approval`, {
        payload: { approval_id: id, status, note: note || undefined },
      });
    },
    async listDistributions() {
      const all = await rows<DistributionItem>('document_distributions');
      return all;
    },
    async reset() { /* live: không reset DB từ UI */ },
  };
}

export interface ResolvedStore {
  mode: StoreMode;
  store: DocumentStore;
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
        await client.get(`${R}/document_incoming?limit=1`);
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
