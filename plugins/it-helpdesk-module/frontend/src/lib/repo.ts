// IT Helpdesk Module — DATA LAYER.
// Hai chế độ sau cùng 1 interface async ItHelpdeskStore:
// - DEMO: createMockRepo (seed + localStorage, offline, không cần login).
// - LIVE: API thật (records CRUD + dispatcher → n8n), cần login ở Launchpad.
// getStore() tự dò: gọi thử API, rớt (401/offline/chưa cài) → DEMO + lý do.
import type {
  ItCategory,
  ItTicket,
  KnowledgeArticle,
  SlaPolicy,
  TicketPriority,
  TicketStatus,
  TicketUpdate,
} from '../types';
import {
  seedCategories,
  seedKnowledge,
  seedPolicies,
  seedTickets,
  seedUpdates,
} from '../data/seed';

const LS_KEY = 'proteus:it-helpdesk-module:v1';

interface Persisted {
  tickets: ItTicket[];
  updates: TicketUpdate[];
  knowledge: KnowledgeArticle[];
  policies: SlaPolicy[];
}

function load(): Persisted {
  const fallback: Persisted = {
    tickets: seedTickets,
    updates: seedUpdates,
    knowledge: seedKnowledge,
    policies: seedPolicies,
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      tickets: parsed.tickets ?? fallback.tickets,
      updates: parsed.updates ?? fallback.updates,
      knowledge: parsed.knowledge ?? fallback.knowledge,
      policies: parsed.policies ?? fallback.policies,
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

const SLA_HOURS: Record<TicketPriority, number> = { P1: 1, P2: 4, P3: 24, P4: 72 };

function slaDeadline(priority: TicketPriority, policies?: SlaPolicy[]): string {
  const h = policies?.find((p) => p.priority === priority)?.resolve_time_hours
    ?? SLA_HOURS[priority];
  return new Date(Date.now() + h * 3600000).toISOString();
}

export interface ItHelpdeskRepo {
  listTickets(): ItTicket[];
  createTicket(input: {
    category_id: string;
    title: string;
    description: string;
    priority: TicketPriority;
    requester_name: string;
  }): ItTicket;
  moveTicket(id: string, status: TicketStatus): void;
  listUpdates(ticket_id: string): TicketUpdate[];
  addUpdate(ticket_id: string, user_name: string, message: string, new_status?: string): TicketUpdate;
  listCategories(): ItCategory[];
  listPolicies(): SlaPolicy[];
  upsertPolicy(priority: TicketPriority, hours: number): SlaPolicy;
  listKnowledge(): KnowledgeArticle[];
  createKnowledge(input: Omit<KnowledgeArticle, 'id' | 'view_count' | 'created_at'>): KnowledgeArticle;
  updateKnowledge(id: string, patch: Partial<KnowledgeArticle>): KnowledgeArticle;
  removeKnowledge(id: string): void;
  reset(): void;
}

export function createMockRepo(): ItHelpdeskRepo {
  return {
    listTickets: () => load().tickets,
    createTicket(input) {
      const s = load();
      const row: ItTicket = {
        ...input,
        id: uid(),
        status: 'OPEN',
        assignee_name: '',
        sla_deadline: slaDeadline(input.priority, s.policies),
        escalated: false,
        feedback_rating: null,
        created_at: new Date().toISOString(),
      };
      s.tickets = [row, ...s.tickets];
      save(s);
      return row;
    },
    moveTicket(id, status) {
      const s = load();
      const t = s.tickets.find((x) => x.id === id);
      if (!t) throw new Error('Không tìm thấy ticket');
      t.status = status;
      save(s);
    },
    listUpdates: (ticket_id) => load().updates.filter((u) => u.ticket_id === ticket_id),
    addUpdate(ticket_id, user_name, message, new_status) {
      const s = load();
      const row: TicketUpdate = {
        id: uid(),
        ticket_id,
        user_name,
        message,
        new_status: new_status ?? null,
        created_at: new Date().toISOString(),
      };
      s.updates = [...s.updates, row];
      if (new_status) {
        const t = s.tickets.find((x) => x.id === ticket_id);
        if (t) t.status = new_status as TicketStatus;
      }
      save(s);
      return row;
    },
    listCategories: () => seedCategories,
    listPolicies: () => load().policies,
    upsertPolicy(priority, hours) {
      const s = load();
      if (hours <= 0) throw new Error('Số giờ SLA phải > 0');
      const p = s.policies.find((x) => x.priority === priority);
      if (p) p.resolve_time_hours = hours;
      else s.policies = [...s.policies, { id: uid(), priority, resolve_time_hours: hours }];
      save(s);
      return s.policies.find((x) => x.priority === priority)!;
    },
    listKnowledge: () => load().knowledge,
    createKnowledge(input) {
      const s = load();
      const row: KnowledgeArticle = {
        ...input,
        id: uid(),
        view_count: 0,
        created_at: new Date().toISOString(),
      };
      s.knowledge = [row, ...s.knowledge];
      save(s);
      return row;
    },
    updateKnowledge(id, patch) {
      const s = load();
      const k = s.knowledge.find((x) => x.id === id);
      if (!k) throw new Error('Không tìm thấy bài viết');
      Object.assign(k, patch);
      save(s);
      return k;
    },
    removeKnowledge(id) {
      const s = load();
      s.knowledge = s.knowledge.filter((k) => k.id !== id);
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

export interface ItHelpdeskStore {
  listTickets(): Promise<ItTicket[]>;
  createTicket(input: {
    category_id: string;
    title: string;
    description: string;
    priority: TicketPriority;
    requester_name: string;
  }): Promise<ItTicket>;
  moveTicket(id: string, status: TicketStatus): Promise<void>;
  listUpdates(ticket_id: string): Promise<TicketUpdate[]>;
  addUpdate(ticket_id: string, user_name: string, message: string, new_status?: string): Promise<TicketUpdate>;
  listCategories(): Promise<ItCategory[]>;
  listPolicies(): Promise<SlaPolicy[]>;
  upsertPolicy(priority: TicketPriority, hours: number): Promise<SlaPolicy>;
  listKnowledge(): Promise<KnowledgeArticle[]>;
  createKnowledge(input: Omit<KnowledgeArticle, 'id' | 'view_count' | 'created_at'>): Promise<KnowledgeArticle>;
  updateKnowledge(id: string, patch: Partial<KnowledgeArticle>): Promise<KnowledgeArticle>;
  removeKnowledge(id: string): Promise<void>;
  reset(): Promise<void>;
}

const R = '/v1/plugins/it-helpdesk-module/records';

function toTicket(r: Record<string, unknown>): ItTicket {
  return {
    id: String(r.id ?? ''),
    requester_name: String(r.requester_name ?? r.requester_id ?? ''),
    category_id: String(r.category_id ?? ''),
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    priority: (r.priority as TicketPriority) ?? 'P3',
    status: (r.status as TicketStatus) ?? 'OPEN',
    assignee_name: String(r.assignee_name ?? r.assignee_id ?? ''),
    sla_deadline: String(r.sla_deadline ?? ''),
    escalated: Boolean(r.escalated ?? false),
    feedback_rating: r.feedback_rating == null ? null : Number(r.feedback_rating),
    created_at: String(r.created_at ?? ''),
  };
}

function toUpdate(r: Record<string, unknown>): TicketUpdate {
  return {
    id: String(r.id ?? ''),
    ticket_id: String(r.ticket_id ?? ''),
    user_name: String(r.user_name ?? r.user_id ?? ''),
    message: String(r.message ?? ''),
    new_status: r.new_status == null ? null : String(r.new_status),
    created_at: String(r.created_at ?? ''),
  };
}

function toKnowledge(r: Record<string, unknown>): KnowledgeArticle {
  return {
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    content_md: String(r.content_md ?? ''),
    category_id: String(r.category_id ?? ''),
    author_name: String(r.author_name ?? r.author_id ?? ''),
    view_count: Number(r.view_count ?? 0),
    is_published: Boolean(r.is_published ?? true),
    created_at: String(r.created_at ?? ''),
  };
}

function toPolicy(r: Record<string, unknown>): SlaPolicy {
  return {
    id: String(r.id ?? ''),
    priority: r.priority as TicketPriority,
    resolve_time_hours: Number(r.resolve_time_hours ?? 24),
  };
}

/** Demo store: bọc mock sync thành async (giữ nguyên localStorage). */
export function createDemoStore(): ItHelpdeskStore {
  const m = createMockRepo();
  return {
    async listTickets() { return m.listTickets(); },
    async createTicket(i) { return m.createTicket(i); },
    async moveTicket(id, s) { m.moveTicket(id, s); },
    async listUpdates(t) { return m.listUpdates(t); },
    async addUpdate(t, u, msg, ns) { return m.addUpdate(t, u, msg, ns); },
    async listCategories() { return m.listCategories(); },
    async listPolicies() { return m.listPolicies(); },
    async upsertPolicy(p, h) { return m.upsertPolicy(p, h); },
    async listKnowledge() { return m.listKnowledge(); },
    async createKnowledge(i) { return m.createKnowledge(i); },
    async updateKnowledge(id, p) { return m.updateKnowledge(id, p); },
    async removeKnowledge(id) { m.removeKnowledge(id); },
    async reset() { m.reset(); },
  };
}

/** Live store: records CRUD + dispatcher → n8n webhook. */
export function createLiveStore(client: BffClient): ItHelpdeskStore {
  const rows = async <T>(table: string): Promise<T[]> => {
    const res = await client.get<{ rows: T[] }>(`${R}/${table}?limit=100`);
    return res.rows ?? [];
  };
  return {
    async listTickets() {
      return (await rows<Record<string, unknown>>('it_tickets')).map(toTicket);
    },
    // Tạo ticket đi qua workflow wf_ticket_create (tạo + phân công + nhắn).
    async createTicket(i) {
      await client.post('/v1/plugins/it-helpdesk-module/actions/wf_ticket_create', {
        payload: { ...i },
      });
      const all = await this.listTickets();
      const found = all.find((t) => t.title === i.title) ?? all[0];
      if (!found) throw new Error('Tạo ticket xong nhưng chưa thấy trong DB — tải lại sau giây lát.');
      return found;
    },
    async moveTicket(id, status) {
      await client.patch(`${R}/it_tickets/${id}`, { status });
    },
    async listUpdates(ticket_id) {
      const all = await rows<Record<string, unknown>>('it_ticket_updates');
      return all.map(toUpdate).filter((u) => u.ticket_id === ticket_id);
    },
    async addUpdate(ticket_id, user_name, message, new_status) {
      const row = await client.post<Record<string, unknown>>(
        `${R}/it_ticket_updates`,
        { ticket_id, user_name, message, new_status: new_status ?? null },
      );
      if (new_status) {
        try {
          await client.patch(`${R}/it_tickets/${ticket_id}`, { status: new_status });
        } catch { /* best-effort */ }
      }
      return toUpdate(row);
    },
    async listCategories() {
      try {
        const cats = await rows<Record<string, unknown>>('it_categories');
        return cats.map((c) => ({
          id: String(c.id),
          name: String(c.name),
          description: String(c.description ?? ''),
        }));
      } catch {
        return seedCategories;
      }
    },
    async listPolicies() {
      return (await rows<Record<string, unknown>>('it_sla_policies')).map(toPolicy);
    },
    async upsertPolicy(priority, hours) {
      const all = await this.listPolicies();
      const cur = all.find((p) => p.priority === priority);
      if (cur) {
        const row = await client.patch<Record<string, unknown>>(
          `${R}/it_sla_policies/${cur.id}`, { resolve_time_hours: hours },
        );
        return toPolicy(row);
      }
      const row = await client.post<Record<string, unknown>>(
        `${R}/it_sla_policies`, { priority, resolve_time_hours: hours },
      );
      return toPolicy(row);
    },
    async listKnowledge() {
      return (await rows<Record<string, unknown>>('it_knowledge_base')).map(toKnowledge);
    },
    async createKnowledge(i) {
      const row = await client.post<Record<string, unknown>>(
        `${R}/it_knowledge_base`,
        {
          title: i.title,
          content_md: i.content_md,
          category_id: i.category_id || null,
          author_name: i.author_name,
          is_published: i.is_published,
        },
      );
      return toKnowledge(row);
    },
    async updateKnowledge(id, patch) {
      const row = await client.patch<Record<string, unknown>>(
        `${R}/it_knowledge_base/${id}`, patch,
      );
      return toKnowledge(row);
    },
    async removeKnowledge(id) {
      await client.del(`${R}/it_knowledge_base/${id}`);
    },
    async reset() { /* live: không reset DB từ UI */ },
  };
}

export interface ResolvedStore {
  mode: StoreMode;
  store: ItHelpdeskStore;
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
        await client.get(`${R}/it_tickets?limit=1`);
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
