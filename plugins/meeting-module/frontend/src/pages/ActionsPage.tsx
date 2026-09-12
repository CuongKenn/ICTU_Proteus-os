// Meeting Module — Việc cần làm: CRUD action items qua records.
import React, { useCallback, useEffect, useState } from 'react';
import { ACTION_LABEL, type ActionItem, type ActionStatus, type Booking } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, Select, SimpleBadge, TableWrap, Toolbar, td, th } from '../components/ui';

export function ActionsPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<ActionItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [ac, bk] = await Promise.all([store.listActions(), store.listBookings()]);
      setRows(ac);
      setBookings(bk);
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

  const bookingName = (id: string) => bookings.find((b) => b.id === id)?.title ?? '—';
  const filtered = rows.filter((a) => {
    const q = search.trim().toLowerCase();
    return (
      (!q || a.task_desc.toLowerCase().includes(q) || a.owner_id.toLowerCase().includes(q)) &&
      (filter === 'ALL' || a.status === filter)
    );
  });

  const color = (s: ActionStatus) =>
    s === 'COMPLETED' ? '#22c55e' : s === 'CANCELLED' ? '#64748b' : s === 'IN_PROGRESS' ? '#38bdf8' : '#f59e0b';

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo việc, người phụ trách...">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">Mọi trạng thái</option>
          <option value="PENDING">Chờ làm</option>
          <option value="IN_PROGRESS">Đang làm</option>
          <option value="COMPLETED">Hoàn tất</option>
          <option value="CANCELLED">Đã hủy</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Thêm việc</Btn>
      </Toolbar>
      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Việc / Cuộc họp</th>
            <th style={th}>Người phụ trách</th>
            <th style={th}>Hạn</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Cập nhật</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((a) => (
            <tr key={a.id}>
              <td style={td}>
                {a.task_desc}
                <div style={{ color: C.muted, fontSize: '.78rem' }}>{bookingName(a.booking_id)}</div>
              </td>
              <td style={td}>{a.owner_id}</td>
              <td style={td}>{a.due_date || '—'}</td>
              <td style={td}><SimpleBadge text={ACTION_LABEL[a.status]} color={color(a.status)} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <Select
                  value={a.status}
                  onChange={(e) => mutate(() => store!.updateAction(a.id, { status: e.target.value as ActionStatus }))}
                >
                  <option value="PENDING">Chờ làm</option>
                  <option value="IN_PROGRESS">Đang làm</option>
                  <option value="COMPLETED">Hoàn tất</option>
                  <option value="CANCELLED">Đã hủy</option>
                </Select>{' '}
                <button
                  onClick={() => {
                    if (confirm('Xóa việc này?')) mutate(() => store!.removeAction(a.id));
                  }}
                  style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', padding: 0, fontSize: '.85rem' }}
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có việc phù hợp.</p>}
      {showCreate && (
        <CreateForm
          bookings={bookings.map((b) => ({ id: b.id, label: b.title }))}
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createAction(v);
              setShowCreate(false);
            })
          }
        />
      )}
      <p style={{ color: C.muted, fontSize: '.82rem' }}>
        Việc cần làm CRUD trực tiếp `meeting_action_items`; nhắc việc định kỳ qua `wf_action_item_followup`.
      </p>
    </div>
  );
}

function CreateForm(props: {
  bookings: Array<{ id: string; label: string }>;
  onClose: () => void;
  onSubmit: (v: { booking_id: string; task_desc: string; owner_id: string; due_date: string }) => Promise<void>;
}) {
  const [booking_id, setBooking] = useState(props.bookings[0]?.id ?? '');
  const [task_desc, setDesc] = useState('');
  const [owner_id, setOwner] = useState('');
  const [due_date, setDue] = useState('');
  return (
    <Modal title="Thêm việc cần làm" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Select value={booking_id} onChange={(e) => setBooking(e.target.value)}>
          {props.bookings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </Select>
        <Input placeholder="Nội dung việc (VD Hoàn thiện biên bản họp)" value={task_desc} onChange={(e) => setDesc(e.target.value)} />
        <Input placeholder="Người phụ trách" value={owner_id} onChange={(e) => setOwner(e.target.value)} />
        <Input type="date" value={due_date} onChange={(e) => setDue(e.target.value)} />
        <Btn
          primary
          disabled={!task_desc.trim() || !booking_id}
          onClick={() => props.onSubmit({ booking_id, task_desc: task_desc.trim(), owner_id: owner_id.trim() || '—', due_date })}
        >
          Thêm việc
        </Btn>
      </div>
    </Modal>
  );
}
