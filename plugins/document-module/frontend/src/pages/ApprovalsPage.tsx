// Document Module — Phê duyệt: duyệt/từ chối theo luồng ký tuần tự.
// LIVE đi qua dispatcher wf_document_approval; DEMO cập nhật localStorage.
import React, { useCallback, useEffect, useState } from 'react';
import { APPROVAL_LABEL, type ApprovalItem, type OutgoingDoc } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, Select, SimpleBadge, TableWrap, Toolbar, td, th } from '../components/ui';

export function ApprovalsPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<ApprovalItem[]>([]);
  const [docs, setDocs] = useState<OutgoingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [reviewing, setReviewing] = useState<{ item: ApprovalItem; status: 'approved' | 'rejected' } | null>(null);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [ap, out] = await Promise.all([store.listApprovals(), store.listOutgoing()]);
      setRows(ap);
      setDocs(out);
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

  const nameOf = (id: string) => {
    const d = docs.find((x) => x.id === id);
    return d ? `${d.so_van_ban || '(nháp)'} — ${d.tieu_de ?? ''}` : id;
  };
  const filtered = rows.filter((a) => {
    const q = search.trim().toLowerCase();
    return (!q || nameOf(a.document_id).toLowerCase().includes(q)) && (filter === 'ALL' || a.status === filter);
  });

  const color = (s: string) => (s === 'approved' ? '#22c55e' : s === 'rejected' ? '#ef4444' : '#f59e0b');

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo văn bản...">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">Mọi trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Từ chối</option>
        </Select>
      </Toolbar>
      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Văn bản</th>
            <th style={th}>Người duyệt / Bước</th>
            <th style={th}>Ghi chú / Ký lúc</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Duyệt</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((a) => (
            <tr key={a.id}>
              <td style={td}>{nameOf(a.document_id)}</td>
              <td style={td}>
                {a.approver_id}
                <div style={{ color: C.muted, fontSize: '.78rem' }}>Bước {a.order_no} · {a.document_type}</div>
              </td>
              <td style={td}>
                {a.note || '—'}
                <div style={{ color: C.muted, fontSize: '.78rem' }}>{a.signed_at ? String(a.signed_at).slice(0, 16).replace('T', ' ') : ''}</div>
              </td>
              <td style={td}><SimpleBadge text={APPROVAL_LABEL[a.status]} color={color(a.status)} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {a.status === 'pending' ? (
                  <>
                    <button onClick={() => setReviewing({ item: a, status: 'approved' })} style={ok}>Duyệt</button>{' '}
                    <button onClick={() => setReviewing({ item: a, status: 'rejected' })} style={no}>Từ chối</button>
                  </>
                ) : (
                  <span style={{ color: C.muted }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có yêu cầu phù hợp.</p>}
      {reviewing && (
        <ReviewForm
          title={`${reviewing.status === 'approved' ? 'Duyệt' : 'Từ chối'} — ${nameOf(reviewing.item.document_id)}`}
          onClose={() => setReviewing(null)}
          onSubmit={(note) =>
            mutate(async () => {
              await store!.reviewApproval(reviewing.item.id, reviewing.status, note);
              setReviewing(null);
            })
          }
        />
      )}
      <p style={{ color: C.muted, fontSize: '.82rem' }}>
        Duyệt ký đi qua workflow `wf_document_approval` (ký tuần tự theo `order_no`).
      </p>
    </div>
  );
}

const ok: React.CSSProperties = { background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer' };
const no: React.CSSProperties = { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' };

function ReviewForm(props: { title: string; onClose: () => void; onSubmit: (note: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Ghi chú duyệt (tùy chọn)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Btn primary onClick={() => props.onSubmit(note.trim())}>Xác nhận</Btn>
      </div>
    </Modal>
  );
}
