// Meeting Module — Đặt phòng: search/filter + đặt mới + hủy.
// Tạo mới: check trùng giờ phía client rồi gọi dispatcher wf_meeting_booking.
import React, { useCallback, useEffect, useState } from 'react';
import { BOOKING_LABEL, fmtTime, type Booking, type MeetingRoom } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Badge, Btn, C, DataSourceBar, InlineError, Input, Modal, Select, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

const colorOf = (s: Booking['status']) =>
  s === 'CANCELLED' ? C.muted : s === 'COMPLETED' ? C.green : s === 'SCHEDULED' ? C.accent : C.amber;

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function BookingsPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [room, setRoom] = useState<string>(ALL);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [bk, rm] = await Promise.all([store.listBookings(), store.listRooms()]);
      setRows(bk);
      setRooms(rm);
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = async (fn: () => Promise<unknown>) => {
    if (!store) return;
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errText(e));
    }
  };

  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? '—';
  const filtered = rows.filter((b) => {
    const q = search.trim().toLowerCase();
    const hit = !q || b.title.toLowerCase().includes(q) || roomName(b.room_id).toLowerCase().includes(q);
    return hit && (room === ALL || b.room_id === room);
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo tên cuộc họp, phòng...">
        <Select value={room} onChange={(e) => setRoom(e.target.value)}>
          <option value={ALL}>Mọi phòng</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Đặt phòng</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Cuộc họp / Người đặt</th>
            <th style={th}>Phòng</th>
            <th style={th}>Thời gian</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((b) => (
            <tr key={b.id}>
              <td style={td}>
                <b style={{ color: C.text }}>{b.title}</b>
                <div style={{ color: C.muted, fontSize: '.78rem' }}>{b.organizer_id}</div>
                {b.description && <div style={{ fontSize: '.82rem' }}>{b.description}</div>}
              </td>
              <td style={td}>{roomName(b.room_id)}</td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {fmtTime(b.start_time)}
                <div style={{ color: C.muted }}>→ {fmtTime(b.end_time)}</div>
              </td>
              <td style={td}><Badge text={BOOKING_LABEL[b.status]} color={colorOf(b.status)} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {(b.status === 'SCHEDULED' || b.status === 'IN_PROGRESS') ? (
                  <button
                    onClick={() => {
                      if (confirm(`Hủy lịch "${b.title}"?`)) mutate(() => store!.cancelBooking(b.id));
                    }}
                    style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', padding: 0, fontSize: '.85rem' }}
                  >
                    Hủy
                  </button>
                ) : (
                  <span style={{ color: C.muted }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có lịch phù hợp.</p>}
      {mode === 'live' && (
        <p style={{ color: C.muted, fontSize: '.78rem' }}>
          Nút “Đặt phòng” kiểm tra trùng giờ phía client rồi gọi workflow n8n
          `wf_meeting_booking` qua dispatcher (202 → xử lý ngầm, gửi invite).
        </p>
      )}

      {showCreate && (
        <BookingForm
          rooms={rooms.filter((r) => r.is_active)}
          onClose={() => setShowCreate(false)}
          onSubmit={(v) => mutate(async () => { await store!.createBooking(v); setShowCreate(false); })}
        />
      )}
    </div>
  );
}

function BookingForm(props: {
  rooms: MeetingRoom[];
  onClose: () => void;
  onSubmit: (v: Omit<Booking, 'id' | 'status'>) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [room_id, setRoomId] = useState(props.rooms[0]?.id ?? '');
  const [organizer_id, setOrg] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [description, setDesc] = useState('');
  return (
    <Modal title="Đặt phòng họp" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Tên cuộc họp" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Select value={room_id} onChange={(e) => setRoomId(e.target.value)}>
          {props.rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.capacity} chỗ)</option>)}
        </Select>
        <Input placeholder="Người đặt / Đơn vị" value={organizer_id} onChange={(e) => setOrg(e.target.value)} />
        <label style={{ color: C.muted, fontSize: '.82rem' }}>Bắt đầu
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label style={{ color: C.muted, fontSize: '.82rem' }}>Kết thúc
          <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <Input placeholder="Nội dung / ghi chú" value={description} onChange={(e) => setDesc(e.target.value)} />
        <Btn
          primary
          disabled={!title.trim() || !room_id || !start || !end}
          onClick={() =>
            props.onSubmit({
              title: title.trim(),
              room_id,
              organizer_id: organizer_id.trim() || '—',
              start_time: new Date(start).toISOString(),
              end_time: new Date(end).toISOString(),
              description: description.trim(),
            })
          }
        >
          Đặt phòng
        </Btn>
      </div>
    </Modal>
  );
}
