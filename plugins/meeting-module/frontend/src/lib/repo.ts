// Meeting Module — DATA LAYER.
// Hai chế độ sau cùng 1 interface async MeetingStore:
// - DEMO: mock sync (seed + localStorage, offline, không cần login).
// - LIVE: API thật (records CRUD + dispatcher → n8n), cần login ở Launchpad.
// getStore() tự dò: gọi thử API, rớt (401/offline/chưa cài) → DEMO + lý do.
// Mọi gọi API qua BffClient tới /api/proxy; KHÔNG BAO GIỜ gửi tenant_id.
import type {
  ActionItem,
  ActionStatus,
  Booking,
  BookingStatus,
  MeetingRoom,
} from '../types';
import { seedActions, seedBookings, seedRooms } from '../data/seed';

const LS_KEY = 'proteus:meeting-module:v1';

interface Persisted {
  rooms: MeetingRoom[];
  bookings: Booking[];
  actions: ActionItem[];
}

function load(): Persisted {
  const fallback: Persisted = {
    rooms: seedRooms,
    bookings: seedBookings,
    actions: seedActions,
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      rooms: parsed.rooms ?? fallback.rooms,
      bookings: parsed.bookings ?? fallback.bookings,
      actions: parsed.actions ?? fallback.actions,
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

/** Check trùng giờ phía client: 2 khoảng [a,b) và [c,d) giao nhau? */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export function assertNoOverlap(
  bookings: Booking[],
  room_id: string,
  start_time: string,
  end_time: string,
  ignoreId?: string,
): void {
  if (!(new Date(start_time) < new Date(end_time))) {
    throw new Error('Giờ kết thúc phải sau giờ bắt đầu');
  }
  const clash = bookings.find(
    (b) =>
      b.room_id === room_id &&
      b.id !== ignoreId &&
      b.status !== 'CANCELLED' &&
      overlaps(start_time, end_time, b.start_time, b.end_time),
  );
  if (clash) throw new Error(`Trùng giờ với lịch "${clash.title}" (${clash.start_time} → ${clash.end_time})`);
}

export interface MeetingRepo {
  listRooms(): MeetingRoom[];
  createRoom(input: Omit<MeetingRoom, 'id'>): MeetingRoom;
  updateRoom(id: string, patch: Partial<MeetingRoom>): MeetingRoom;
  listBookings(): Booking[];
  createBooking(input: Omit<Booking, 'id' | 'status'>): Booking;
  cancelBooking(id: string): void;
  listActions(booking_id?: string): ActionItem[];
  createAction(input: Omit<ActionItem, 'id' | 'status'>): ActionItem;
  updateAction(id: string, patch: Partial<ActionItem>): ActionItem;
  removeAction(id: string): void;
  reset(): void;
}

export function createMockRepo(): MeetingRepo {
  return {
    listRooms: () => load().rooms,
    createRoom(input) {
      const s = load();
      const row = { ...input, id: uid() };
      s.rooms = [row, ...s.rooms];
      save(s);
      return row;
    },
    updateRoom(id, patch) {
      const s = load();
      const row = s.rooms.find((r) => r.id === id);
      if (!row) throw new Error('Không tìm thấy phòng họp');
      Object.assign(row, patch);
      save(s);
      return row;
    },
    listBookings: () => load().bookings,
    createBooking(input) {
      const s = load();
      assertNoOverlap(s.bookings, input.room_id, input.start_time, input.end_time);
      const row: Booking = { ...input, id: uid(), status: 'SCHEDULED' };
      s.bookings = [row, ...s.bookings];
      save(s);
      return row;
    },
    cancelBooking(id) {
      const s = load();
      const row = s.bookings.find((b) => b.id === id);
      if (!row) throw new Error('Không tìm thấy lịch đặt');
      row.status = 'CANCELLED' as BookingStatus;
      save(s);
    },
    listActions: (booking_id) => {
      const all = load().actions;
      return booking_id ? all.filter((a) => a.booking_id === booking_id) : all;
    },
    createAction(input) {
      const s = load();
      const row: ActionItem = { ...input, id: uid(), status: 'PENDING' };
      s.actions = [row, ...s.actions];
      save(s);
      return row;
    },
    updateAction(id, patch) {
      const s = load();
      const row = s.actions.find((a) => a.id === id);
      if (!row) throw new Error('Không tìm thấy việc cần làm');
      Object.assign(row, patch);
      save(s);
      return row;
    },
    removeAction(id) {
      const s = load();
      s.actions = s.actions.filter((a) => a.id !== id);
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

export interface MeetingStore {
  listRooms(): Promise<MeetingRoom[]>;
  createRoom(input: Omit<MeetingRoom, 'id'>): Promise<MeetingRoom>;
  updateRoom(id: string, patch: Partial<MeetingRoom>): Promise<MeetingRoom>;
  listBookings(): Promise<Booking[]>;
  createBooking(input: Omit<Booking, 'id' | 'status'>): Promise<Booking>;
  cancelBooking(id: string): Promise<void>;
  listActions(booking_id?: string): Promise<ActionItem[]>;
  createAction(input: Omit<ActionItem, 'id' | 'status'>): Promise<ActionItem>;
  updateAction(id: string, patch: Partial<ActionItem>): Promise<ActionItem>;
  removeAction(id: string): Promise<void>;
  reset(): Promise<void>;
}

const R = '/v1/plugins/meeting-module/records';
const A = '/v1/plugins/meeting-module/actions';

function toRoom(r: Record<string, unknown>): MeetingRoom {
  let amenities: MeetingRoom['amenities'] = { projector: false, whiteboard: false, video_conf: false };
  try {
    const raw = r.amenities_json;
    const o = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>);
    if (o && typeof o === 'object') {
      amenities = {
        projector: Boolean((o as Record<string, unknown>).projector),
        whiteboard: Boolean((o as Record<string, unknown>).whiteboard),
        video_conf: Boolean((o as Record<string, unknown>).video_conf),
      };
    }
  } catch { /* giữ default */ }
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    capacity: Number(r.capacity ?? 0),
    floor: String(r.floor ?? ''),
    amenities,
    is_active: r.is_active !== false,
  };
}

function toBooking(r: Record<string, unknown>): Booking {
  return {
    id: String(r.id ?? ''),
    room_id: String(r.room_id ?? ''),
    title: String(r.title ?? ''),
    organizer_id: String(r.organizer_id ?? ''),
    start_time: String(r.start_time ?? ''),
    end_time: String(r.end_time ?? ''),
    status: (r.status as BookingStatus) ?? 'SCHEDULED',
    description: String(r.description ?? ''),
  };
}

function toAction(r: Record<string, unknown>): ActionItem {
  return {
    id: String(r.id ?? ''),
    booking_id: String(r.booking_id ?? ''),
    task_desc: String(r.task_desc ?? ''),
    owner_id: String(r.owner_id ?? ''),
    due_date: String(r.due_date ?? '').slice(0, 10),
    status: (r.status as ActionStatus) ?? 'PENDING',
  };
}

/** Demo store: bọc mock sync thành async (giữ nguyên localStorage). */
export function createDemoStore(): MeetingStore {
  const m = createMockRepo();
  return {
    async listRooms() { return m.listRooms(); },
    async createRoom(i) { return m.createRoom(i); },
    async updateRoom(id, p) { return m.updateRoom(id, p); },
    async listBookings() { return m.listBookings(); },
    async createBooking(i) { return m.createBooking(i); },
    async cancelBooking(id) { m.cancelBooking(id); },
    async listActions(b) { return m.listActions(b); },
    async createAction(i) { return m.createAction(i); },
    async updateAction(id, p) { return m.updateAction(id, p); },
    async removeAction(id) { m.removeAction(id); },
    async reset() { m.reset(); },
  };
}

/** Live store: records CRUD + dispatcher → n8n webhook. */
export function createLiveStore(client: BffClient): MeetingStore {
  const rows = async <T>(table: string): Promise<T[]> => {
    const res = await client.get<{ rows: T[] }>(`${R}/${table}?limit=100`);
    return res.rows ?? [];
  };
  return {
    async listRooms() {
      return (await rows<Record<string, unknown>>('meeting_rooms')).map(toRoom);
    },
    async createRoom(i) {
      const { amenities, ...rest } = i;
      return toRoom(
        await client.post(`${R}/meeting_rooms`, { ...rest, amenities_json: amenities }),
      );
    },
    async updateRoom(id, p) {
      const { amenities, ...rest } = p;
      return toRoom(
        await client.patch(
          `${R}/meeting_rooms/${id}`,
          amenities ? { ...rest, amenities_json: amenities } : rest,
        ),
      );
    },
    async listBookings() {
      return (await rows<Record<string, unknown>>('meeting_bookings')).map(toBooking);
    },
    // Đặt phòng: check trùng giờ phía client rồi đi qua workflow wf_meeting_booking.
    async createBooking(i) {
      const existing = await this.listBookings();
      assertNoOverlap(existing, i.room_id, i.start_time, i.end_time);
      const row = await client.post<Record<string, unknown>>(
        `${A}/wf_meeting_booking`,
        {
          payload: {
            room_id: i.room_id,
            title: i.title,
            organizer_id: i.organizer_id,
            start_time: i.start_time,
            end_time: i.end_time,
            description: i.description || undefined,
          },
        },
      );
      return toBooking(row);
    },
    async cancelBooking(id) {
      await client.patch(`${R}/meeting_bookings/${id}`, { status: 'CANCELLED' });
    },
    async listActions(booking_id) {
      const all = (await rows<Record<string, unknown>>('meeting_action_items')).map(toAction);
      return booking_id ? all.filter((a) => a.booking_id === booking_id) : all;
    },
    async createAction(i) {
      return toAction(await client.post(`${R}/meeting_action_items`, i));
    },
    async updateAction(id, p) {
      return toAction(await client.patch(`${R}/meeting_action_items/${id}`, p));
    },
    async removeAction(id) {
      await client.del(`${R}/meeting_action_items/${id}`);
    },
    async reset() { /* live: không reset DB từ UI */ },
  };
}

export interface ResolvedStore {
  mode: StoreMode;
  store: MeetingStore;
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
        await client.get(`${R}/meeting_rooms?limit=1`);
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
