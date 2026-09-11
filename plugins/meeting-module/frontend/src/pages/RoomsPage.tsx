// Meeting Module — Phòng họp: search/filter + CRUD phòng (records).
import React, { useCallback, useEffect, useState } from 'react';
import type { MeetingRoom } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Badge, Btn, C, DataSourceBar, InlineError, Input, Modal, Select, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

function amenText(r: MeetingRoom): string {
  const out: string[] = [];
  if (r.amenities.projector) out.push('Máy chiếu');
  if (r.amenities.whiteboard) out.push('Bảng trắng');
  if (r.amenities.video_conf) out.push('Họp trực tuyến');
  return out.length ? out.join(' · ') : '—';
}

export function RoomsPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<MeetingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>(ALL);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<MeetingRoom | null>(null);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await store.listRooms());
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

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    const hit = !q || r.name.toLowerCase().includes(q) || r.floor.toLowerCase().includes(q);
    return hit && (filter === ALL || (filter === 'ACTIVE' ? r.is_active : !r.is_active));
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo tên phòng, tầng...">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value={ALL}>Mọi trạng thái</option>
          <option value="ACTIVE">Đang dùng</option>
          <option value="INACTIVE">Ngừng dùng</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Thêm phòng</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Phòng / Tầng</th>
            <th style={th}>Sức chứa</th>
            <th style={th}>Tiện nghi</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td style={td}>
                <b style={{ color: C.text }}>{r.name}</b>
                <div style={{ color: C.muted, fontSize: '.78rem' }}>{r.floor}</div>
              </td>
              <td style={td}>{r.capacity} chỗ</td>
              <td style={td}>{amenText(r)}</td>
              <td style={td}>
                <Badge text={r.is_active ? 'Đang dùng' : 'Ngừng dùng'} color={r.is_active ? C.green : C.muted} />
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <button onClick={() => setEditing(r)} style={link}>Sửa</button>{' '}
                <button
                  onClick={() => mutate(() => store!.updateRoom(r.id, { is_active: !r.is_active }))}
                  style={link}
                >
                  {r.is_active ? 'Ngừng dùng' : 'Mở lại'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có phòng phù hợp.</p>}

      {showCreate && (
        <RoomForm
          title="Thêm phòng họp"
          onClose={() => setShowCreate(false)}
          onSubmit={(v) => mutate(async () => { await store!.createRoom(v); setShowCreate(false); })}
        />
      )}
      {editing && (
        <RoomForm
          title={`Sửa ${editing.name}`}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(v) => mutate(async () => { await store!.updateRoom(editing.id, v); setEditing(null); })}
        />
      )}
    </div>
  );
}

const link: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#38bdf8',
  cursor: 'pointer',
  padding: 0,
  fontSize: '.85rem',
};

function RoomForm(props: {
  title: string;
  initial?: MeetingRoom;
  onClose: () => void;
  onSubmit: (v: Omit<MeetingRoom, 'id'>) => Promise<void>;
}) {
  const [name, setName] = useState(props.initial?.name ?? '');
  const [capacity, setCap] = useState(String(props.initial?.capacity ?? 10));
  const [floor, setFloor] = useState(props.initial?.floor ?? '');
  const [projector, setPj] = useState(props.initial?.amenities.projector ?? false);
  const [whiteboard, setWb] = useState(props.initial?.amenities.whiteboard ?? false);
  const [video_conf, setVc] = useState(props.initial?.amenities.video_conf ?? false);
  const cb: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '.5rem', color: '#e2e8f0', fontSize: '.88rem' };
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Tên phòng (VD Phòng Họp Lớn A1)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Sức chứa" value={capacity} onChange={(e) => setCap(e.target.value)} />
        <Input placeholder="Vị trí (VD Tầng 1)" value={floor} onChange={(e) => setFloor(e.target.value)} />
        <label style={cb}><input type="checkbox" checked={projector} onChange={(e) => setPj(e.target.checked)} /> Máy chiếu</label>
        <label style={cb}><input type="checkbox" checked={whiteboard} onChange={(e) => setWb(e.target.checked)} /> Bảng trắng</label>
        <label style={cb}><input type="checkbox" checked={video_conf} onChange={(e) => setVc(e.target.checked)} /> Họp trực tuyến</label>
        <Btn
          primary
          disabled={!name.trim()}
          onClick={() =>
            props.onSubmit({
              name: name.trim(),
              capacity: Number(capacity) || 0,
              floor: floor.trim(),
              amenities: { projector, whiteboard, video_conf },
              is_active: props.initial?.is_active ?? true,
            })
          }
        >
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}
