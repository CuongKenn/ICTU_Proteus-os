// CRM — DATA LAYER (DEMO localStorage + LIVE API thật chung interface).
import {
  seedComments,
  seedContacts,
  seedCustomers,
  seedLeads,
  seedOpportunities,
  seedTickets,
} from '../data/seed';
import type {
  Contact,
  Customer,
  Lead,
  LeadStage,
  Opportunity,
  OppStage,
  Ticket,
  TicketComment,
  TicketPriority,
  TicketStatus,
} from '../types';

const LS_KEY = 'proteus:crm-module:v1';

interface Persisted {
  customers: Customer[];
  leads: Lead[];
  opportunities: Opportunity[];
  tickets: Ticket[];
  comments: TicketComment[];
}

function load(): Persisted {
  const fallback: Persisted = {
    customers: seedCustomers,
    leads: seedLeads,
    opportunities: seedOpportunities,
    tickets: seedTickets,
    comments: seedComments,
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      customers: p.customers ?? fallback.customers,
      leads: p.leads ?? fallback.leads,
      opportunities: p.opportunities ?? fallback.opportunities,
      tickets: p.tickets ?? fallback.tickets,
      comments: p.comments ?? fallback.comments,
    };
  } catch {
    return fallback;
  }
}

function save(s: Persisted) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

export const uid = () =>
  'xxxxxxxx-xxxx-4xxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );

export interface CrmRepo {
  listCustomers(): Customer[];
  listContacts(customer_id: string): import('../types').Contact[];
  listLeads(): Lead[];
  moveLead(id: string, stage: LeadStage): void;
  createLead(input: Omit<Lead, 'id' | 'stage'>): Lead;
  convertLead(id: string): Opportunity;
  listOpportunities(): Opportunity[];
  moveOpp(id: string, stage: OppStage): void;
  setProbability(id: string, pct: number): void;
  listTickets(): Ticket[];
  createTicket(input: {
    customer_id: string; title: string; description: string; priority: TicketPriority;
  }): Ticket;
  moveTicket(id: string, status: TicketStatus): void;
  listComments(ticket_id: string): TicketComment[];
  addComment(ticket_id: string, user: string, content: string): TicketComment;
  reset(): void;
}

export function createMockRepo(seedContactsList = seedContacts): CrmRepo {
  return {
    listCustomers: () => load().customers,
    listContacts: (cid) => seedContactsList.filter((c) => c.customer_id === cid),
    listLeads: () => load().leads,
    moveLead(id, stage) {
      const s = load();
      const l = s.leads.find((x) => x.id === id);
      if (l) { l.stage = stage; save(s); }
    },
    createLead(input) {
      const s = load();
      const row: Lead = { ...input, id: uid(), stage: 'NEW' };
      s.leads = [row, ...s.leads];
      save(s);
      return row;
    },
    convertLead(id) {
      const s = load();
      const l = s.leads.find((x) => x.id === id);
      if (!l) throw new Error('Không tìm thấy lead');
      l.stage = 'CONVERTED';
      const opp: Opportunity = {
        id: uid(),
        customer_id: s.customers[0]?.id ?? '',
        title: `Cơ hội từ ${l.company_name || l.contact_name}`,
        value: l.estimated_value,
        probability_pct: 20,
        expected_close_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        stage: 'PROSPECTING',
      };
      s.opportunities = [opp, ...s.opportunities];
      save(s);
      return opp;
    },
    listOpportunities: () => load().opportunities,
    moveOpp(id, stage) {
      const s = load();
      const o = s.opportunities.find((x) => x.id === id);
      if (o) {
        o.stage = stage;
        if (stage === 'CLOSED_WON') o.probability_pct = 100;
        if (stage === 'CLOSED_LOST') o.probability_pct = 0;
        save(s);
      }
    },
    setProbability(id, pct) {
      const s = load();
      const o = s.opportunities.find((x) => x.id === id);
      if (o) { o.probability_pct = Math.max(0, Math.min(100, pct)); save(s); }
    },
    listTickets: () => load().tickets,
    createTicket(input) {
      const s = load();
      const row: Ticket = {
        id: uid(),
        customer_id: input.customer_id,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: 'OPEN',
        sla_deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
        assignee: 'Chưa gán',
        created_at: new Date().toISOString(),
      };
      s.tickets = [row, ...s.tickets];
      save(s);
      return row;
    },
    moveTicket(id, status) {
      const s = load();
      const t = s.tickets.find((x) => x.id === id);
      if (t) { t.status = status; save(s); }
    },
    listComments: (tid) => load().comments.filter((c) => c.ticket_id === tid),
    addComment(ticket_id, user, content) {
      const s = load();
      const row: TicketComment = {
        id: uid(), ticket_id, user, content, created_at: new Date().toISOString(),
      };
      s.comments = [...s.comments, row];
      save(s);
      return row;
    },
    reset() { localStorage.removeItem(LS_KEY); },
  };
}

// ─── Async Store (DEMO + LIVE chung interface) ──────────────
import { ApiError, createBffClient, type BffClient } from './api';

export type StoreMode = 'live' | 'demo';
export type DemoReason = 'unauthenticated' | 'not-installed' | 'offline';

export interface CrmStore {
  listCustomers(): Promise<Customer[]>;
  listContacts(customer_id: string): Promise<Contact[]>;
  listLeads(): Promise<Lead[]>;
  moveLead(id: string, stage: LeadStage): Promise<void>;
  createLead(input: Omit<Lead, 'id' | 'stage'>): Promise<Lead>;
  convertLead(id: string): Promise<Opportunity>;
  listOpportunities(): Promise<Opportunity[]>;
  moveOpp(id: string, stage: OppStage): Promise<void>;
  setProbability(id: string, pct: number): Promise<void>;
  listTickets(): Promise<Ticket[]>;
  createTicket(input: { customer_id: string; title: string; description: string; priority: TicketPriority }): Promise<Ticket>;
  moveTicket(id: string, status: TicketStatus): Promise<void>;
  listComments(ticket_id: string): Promise<TicketComment[]>;
  addComment(ticket_id: string, user: string, content: string): Promise<TicketComment>;
  reset(): Promise<void>;
}

const R = '/v1/plugins/crm-module/records';
const num = (v: unknown) => Number(v ?? 0);

function toLead(r: Record<string, unknown>): Lead {
  return {
    id: String(r.id ?? ''),
    contact_name: String(r.contact_name ?? r.full_name ?? ''),
    company_name: String(r.company_name ?? r.company ?? ''),
    email: String(r.email ?? ''),
    phone: String(r.phone ?? ''),
    source: String(r.source ?? 'WEBSITE'),
    estimated_value: num(r.estimated_value),
    stage: (r.stage as LeadStage) ?? 'NEW',
  };
}

function toOpp(r: Record<string, unknown>): Opportunity {
  return {
    id: String(r.id ?? ''),
    customer_id: String(r.customer_id ?? ''),
    title: String(r.title ?? ''),
    value: num(r.value),
    probability_pct: num(r.probability_pct),
    expected_close_date: String(r.expected_close_date ?? '').slice(0, 10),
    stage: (r.stage as OppStage) ?? 'PROSPECTING',
  };
}

function toTicket(r: Record<string, unknown>): Ticket {
  return {
    id: String(r.id ?? ''),
    customer_id: String(r.customer_id ?? ''),
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    priority: (r.priority as TicketPriority) ?? 'P3',
    status: (r.status as TicketStatus) ?? 'OPEN',
    sla_deadline: String(r.sla_deadline ?? ''),
    assignee: String(r.assignee_name ?? r.assignee ?? 'Chưa gán'),
    created_at: String(r.created_at ?? ''),
  };
}

function toComment(r: Record<string, unknown>): TicketComment {
  return {
    id: String(r.id ?? ''),
    ticket_id: String(r.ticket_id ?? ''),
    user: String(r.user_name ?? r.user ?? ''),
    content: String(r.content ?? ''),
    created_at: String(r.created_at ?? ''),
  };
}

/** Demo store: bọc mock sync thành async. */
export function createDemoStore(seedContactsList = seedContacts): CrmStore {
  const m = createMockRepo(seedContactsList);
  return {
    async listCustomers() { return m.listCustomers(); },
    async listContacts(cid) { return m.listContacts(cid); },
    async listLeads() { return m.listLeads(); },
    async moveLead(id, s) { m.moveLead(id, s); },
    async createLead(i) { return m.createLead(i); },
    async convertLead(id) { return m.convertLead(id); },
    async listOpportunities() { return m.listOpportunities(); },
    async moveOpp(id, s) { m.moveOpp(id, s); },
    async setProbability(id, p) { m.setProbability(id, p); },
    async listTickets() { return m.listTickets(); },
    async createTicket(i) { return m.createTicket(i); },
    async moveTicket(id, s) { m.moveTicket(id, s); },
    async listComments(t) { return m.listComments(t); },
    async addComment(t, u, c) { return m.addComment(t, u, c); },
    async reset() { m.reset(); },
  };
}

/** Live store: records CRUD + dispatcher → n8n webhook. */
export function createLiveStore(client: BffClient): CrmStore {
  const rows = async <T>(table: string): Promise<T[]> => {
    const res = await client.get<{ rows: T[] }>(`${R}/${table}?limit=100`);
    return res.rows ?? [];
  };
  return {
    async listCustomers() {
      return rows<Customer>('crm_customers');
    },
    async listContacts(cid) {
      const all = await rows<Contact>('crm_contacts');
      return all.filter((c) => c.customer_id === cid);
    },
    async listLeads() {
      return (await rows<Record<string, unknown>>('crm_leads')).map(toLead);
    },
    async moveLead(id, stage) {
      await client.patch(`${R}/crm_leads/${id}`, { stage });
    },
    // Tạo lead đi qua workflow wf_lead_capture (ghi DB + nhắn kênh sales).
    async createLead(i) {
      await client.post('/v1/plugins/crm-module/actions/wf_lead_capture', {
        payload: {
          full_name: i.contact_name,
          company: i.company_name,
          email: i.email,
          phone: i.phone,
          source: i.source,
          estimated_value: i.estimated_value,
        },
      });
      const leads = await this.listLeads();
      const found =
        leads.find((l) => l.email && l.email === i.email) ?? leads[0];
      if (!found) throw new Error('Tạo lead xong nhưng chưa thấy trong DB — tải lại sau giây lát.');
      return found;
    },
    async convertLead(id) {
      const leads = await this.listLeads();
      const l = leads.find((x) => x.id === id);
      if (!l) throw new Error('Không tìm thấy lead');
      await client.patch(`${R}/crm_leads/${id}`, { stage: 'CONVERTED' });
      const customers = await this.listCustomers();
      const cust =
        customers.find((c) => l.company_name && c.name.includes(l.company_name)) ??
        customers.find((c) => l.company_name && l.company_name.includes(c.name)) ??
        customers[0];
      return toOpp(
        await client.post(`${R}/crm_opportunities`, {
          customer_id: cust?.id ?? '',
          title: `Cơ hội từ ${l.company_name || l.contact_name}`,
          value: l.estimated_value,
          probability_pct: 20,
          expected_close_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          stage: 'PROSPECTING',
        }),
      );
    },
    async listOpportunities() {
      return (await rows<Record<string, unknown>>('crm_opportunities')).map(toOpp);
    },
    async moveOpp(id, stage) {
      const patch: Record<string, unknown> = { stage };
      if (stage === 'CLOSED_WON') patch.probability_pct = 100;
      if (stage === 'CLOSED_LOST') patch.probability_pct = 0;
      await client.patch(`${R}/crm_opportunities/${id}`, patch);
    },
    async setProbability(id, pct) {
      await client.patch(`${R}/crm_opportunities/${id}`, {
        probability_pct: Math.max(0, Math.min(100, pct)),
      });
    },
    async listTickets() {
      return (await rows<Record<string, unknown>>('crm_tickets')).map(toTicket);
    },
    // Tạo ticket đi qua workflow wf_ticket_assignment (tìm agent → gán → nhắn).
    async createTicket(i) {
      await client.post('/v1/plugins/crm-module/actions/wf_ticket_assignment', {
        payload: { ...i },
      });
      const tickets = await this.listTickets();
      const found = tickets.find((t) => t.title === i.title) ?? tickets[0];
      if (!found) throw new Error('Tạo ticket xong nhưng chưa thấy trong DB — tải lại sau giây lát.');
      return found;
    },
    async moveTicket(id, status) {
      await client.patch(`${R}/crm_tickets/${id}`, { status });
    },
    async listComments(tid) {
      const all = await rows<Record<string, unknown>>('crm_ticket_comments');
      return all
        .map(toComment)
        .filter((c) => c.ticket_id === tid);
    },
    async addComment(ticket_id, user, content) {
      const row = await client.post<Record<string, unknown>>(
        `${R}/crm_ticket_comments`,
        { ticket_id, user_name: user, content },
      );
      return toComment(row);
    },
    async reset() { /* live: không reset DB từ UI */ },
  };
}

export interface ResolvedStore {
  mode: StoreMode;
  store: CrmStore;
  reason?: DemoReason;
  message?: string;
}

let cached: Promise<ResolvedStore> | null = null;

export function getStore(): Promise<ResolvedStore> {
  if (!cached) {
    cached = (async () => {
      const client = createBffClient();
      try {
        await client.get(`${R}/crm_customers?limit=1`);
        return { mode: 'live' as const, store: createLiveStore(client) };
      } catch (e) {
        const st = e instanceof ApiError ? e.status : 0;
        const detail = e instanceof ApiError ? e.detail : String(e);
        const reason: DemoReason =
          st === 401 ? 'unauthenticated'
          : st === 400 || st === 404 ? 'not-installed'
          : 'offline';
        return {
          mode: 'demo' as const,
          store: createDemoStore(),
          reason,
          message: detail,
        };
      }
    })();
  }
  return cached;
}

export function resetStoreCache() {
  cached = null;
}
