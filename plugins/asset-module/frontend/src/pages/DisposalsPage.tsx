// Asset Module — Thanh lý: đề xuất + duyệt/từ chối (PENDING → APPROVED/REJECTED).
import React, { useCallback, useEffect, useState } from 'react';
import type { AssetItem, DisposalRequest } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { C, Btn, DataSourceBar, InlineError, Input, Modal, Select, SimpleBadge, TableWrap, Toolbar, td, th } from '../components/ui';

export function DisposalsPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<DisposalRequest[]>([]);
  const [items, setItems] = useState<AssetItem[]>([]);
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
      const [dp, it] = await Promise.all([store.listDisposals(), store.listItems()]);
      setRows(dp);
      setItems(it);
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
    const it = items.find((i) => i.id === id);
    return it ? `${it.code} — ${it.name}` : id;
  };
  const filtered = rows.filter((d) => {
    const q = search.trim().toLowerCase();
    return (!q || nameOf(d.asset_id).toLowerCase().includes(q)) && (filter === 'ALL' || d.status === filter);
  });

  const color = (s: string) => (s === 'APPROVED' ? '#22c55e' : s === 'REJECTED' ? '#ef4444' : '#f59e0b');

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo tài sản...">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">Mọi trạng thái</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Đề xuất thanh lý</Btn>
      </Toolbar>
      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Tài sản</th>
            <th style={th}>Lý do / Người đề xuất</th>
            <th style={th}>Giá trị ước tính</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Duyệt</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((d) => (
            <tr key={d.id}>
              <td style={td}>{nameOf(d.asset_id)}</td>
              <td style={td}>
                {d.reason}
                <div style={{ color: C.muted, fontSize: '.78rem' }}>{d.requester} · {String(d.created_at).slice(0, 10)}</div>
              </td>
              <td style={td}>{new Intl.NumberFormat('vi-VN').format(d.estimated_value)} đ</td>
              <td style={td}><SimpleBadge text={d.status} color={color(d.status)} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {d.status === 'PENDING' ? (
                  <>
                    <button onClick={() => mutate(() => store!.reviewDisposal(d.id, 'APPROVED'))} style={ok}>Duyệt</button>{' '}
                    <button onClick={() => mutate(() => store!.reviewDisposal(d.id, 'REJECTED'))} style={no}>Từ chối</button>
                  </>
                ) : (
                  <span style={{ color: C.muted }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {showCreate && (
        <CreateForm
          assets={items.filter((i) => i.status !== 'DISPOSED').map((i) => ({ id: i.id, label: `${i.code} — ${i.name}` }))}
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createDisposal(v);
              setShowCreate(false);
            })
          }
        />
      )}
      <p style={{ color: C.muted, fontSize: '.82rem' }}>
        Duyệt thanh lý sẽ chuyển tài sản sang `DISPOSED` và đưa giá trị còn lại về 0 (mô phỏng workflow `wf_asset_request`).
      </p>
    </div>
  );
}

const ok: React.CSSProperties = { background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer' };
const no: React.CSSProperties = { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' };

function CreateForm(props: {
  assets: Array<{ id: string; label: string }>;
  onClose: () => void;
  onSubmit: (v: { asset_id: string; requester: string; reason: string; estimated_value: number }) => Promise<void>;
}) {
  const [asset_id, setAsset] = useState(props.assets[0]?.id ?? '');
  const [requester, setRequester] = useState('');
  const [reason, setReason] = useState('');
  const [val, setVal] = useState('0');
  return (
    <Modal title="Đề xuất thanh lý" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Select value={asset_id} onChange={(e) => setAsset(e.target.value)}>
          {props.assets.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </Select>
        <Input placeholder="Người đề xuất / Phòng ban" value={requester} onChange={(e) => setRequester(e.target.value)} />
        <Input placeholder="Lý do thanh lý" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Input placeholder="Giá trị ước tính (VND)" value={val} onChange={(e) => setVal(e.target.value)} />
        <Btn primary onClick={() => props.onSubmit({ asset_id, requester, reason, estimated_value: Number(val) || 0 })}>
          Gửi đề xuất
        </Btn>
      </div>
    </Modal>
  );
}
