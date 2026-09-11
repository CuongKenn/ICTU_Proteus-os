// Document Module — Văn bản đi: search/filter + soạn thảo + chuyển ký/ban hành.
// CRUD qua records; ký duyệt thực hiện ở trang Phê duyệt (wf_document_approval).
import React, { useCallback, useEffect, useState } from 'react';
import { OUTGOING_LABEL, type DocumentCategory, type OutgoingDoc } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Badge, Btn, C, DataSourceBar, InlineError, Input, Modal, Select, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

const colorOf = (s: OutgoingDoc['status']) =>
  s === 'published' ? C.green : s === 'signed' ? C.accent : s === 'pending' ? C.amber : C.muted;

export function OutgoingPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<OutgoingDoc[]>([]);
  const [cats, setCats] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<OutgoingDoc | null>(null);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [out, ct] = await Promise.all([store.listOutgoing(), store.listCategories()]);
      setRows(out);
      setCats(ct);
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

  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? '—';
  const filtered = rows.filter((d) => {
    const q = search.trim().toLowerCase();
    const hit =
      !q ||
      d.so_van_ban.toLowerCase().includes(q) ||
      (d.tieu_de ?? '').toLowerCase().includes(q);
    return hit && (status === ALL || d.status === status);
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo số VB, tiêu đề...">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value={ALL}>Mọi trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="pending">Chờ ký</option>
          <option value="signed">Đã ký</option>
          <option value="published">Đã ban hành</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Soạn văn bản</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Số VB / Loại</th>
            <th style={th}>Tiêu đề / Người ký</th>
            <th style={th}>Ngày ban hành</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((d) => (
            <tr key={d.id}>
              <td style={td}>
                <b style={{ color: C.text }}>{d.so_van_ban || '(chưa cấp số)'}</b>
                <div style={{ color: C.muted, fontSize: '.78rem' }}>{catName(d.loai_vb)}</div>
              </td>
              <td style={td}>
                {d.tieu_de ?? '—'}
                <div style={{ color: C.muted, fontSize: '.78rem' }}>Ký: {d.nguoi_ky ?? '—'}</div>
              </td>
              <td style={td}>{d.ngay_phat_hanh}</td>
              <td style={td}><Badge text={OUTGOING_LABEL[d.status]} color={colorOf(d.status)} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <button onClick={() => setEditing(d)} style={link}>Sửa</button>{' '}
                {d.status === 'draft' && (
                  <button onClick={() => mutate(() => store!.updateOutgoing(d.id, { status: 'pending' }))} style={link}>
                    Trình ký
                  </button>
                )}{' '}
                {d.status === 'signed' && (
                  <button onClick={() => mutate(() => store!.updateOutgoing(d.id, { status: 'published' }))} style={link}>
                    Ban hành
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có văn bản phù hợp.</p>}

      {showCreate && (
        <OutgoingForm
          title="Soạn văn bản đi"
          categories={cats}
          onClose={() => setShowCreate(false)}
          onSubmit={(v) => mutate(async () => { await store!.createOutgoing(v); setShowCreate(false); })}
        />
      )}
      {editing && (
        <OutgoingForm
          title="Sửa văn bản đi"
          initial={editing}
          categories={cats}
          onClose={() => setEditing(null)}
          onSubmit={(v) => mutate(async () => { await store!.updateOutgoing(editing.id, v); setEditing(null); })}
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

function OutgoingForm(props: {
  title: string;
  initial?: OutgoingDoc;
  categories: DocumentCategory[];
  onClose: () => void;
  onSubmit: (v: Omit<OutgoingDoc, 'id'>) => Promise<void>;
}) {
  const [tieu_de, setTieuDe] = useState(props.initial?.tieu_de ?? '');
  const [loai_vb, setLoai] = useState(props.initial?.loai_vb ?? props.categories[0]?.id ?? '');
  const [so_van_ban, setSo] = useState(props.initial?.so_van_ban ?? '');
  const [nguoi_ky, setNguoiKy] = useState(props.initial?.nguoi_ky ?? '');
  const [ngay_phat_hanh, setNgay] = useState(
    props.initial?.ngay_phat_hanh ?? new Date().toISOString().slice(0, 10),
  );
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Tiêu đề văn bản" value={tieu_de} onChange={(e) => setTieuDe(e.target.value)} />
        <Select value={loai_vb} onChange={(e) => setLoai(e.target.value)}>
          {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input placeholder="Số văn bản (để trống nếu là nháp)" value={so_van_ban} onChange={(e) => setSo(e.target.value)} />
        <Input placeholder="Người ký" value={nguoi_ky} onChange={(e) => setNguoiKy(e.target.value)} />
        <Input type="date" value={ngay_phat_hanh} onChange={(e) => setNgay(e.target.value)} />
        <Btn
          primary
          disabled={!tieu_de.trim()}
          onClick={() =>
            props.onSubmit({
              so_van_ban: so_van_ban.trim(),
              loai_vb,
              nguoi_ky: nguoi_ky.trim() || null,
              ngay_phat_hanh,
              file_url: props.initial?.file_url ?? '',
              status: props.initial?.status ?? 'draft',
              tieu_de: tieu_de.trim(),
            })
          }
        >
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}
