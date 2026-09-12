// Procurement Module — Nhà cung cấp: search + CRUD + đánh giá sao.
import React, { useCallback, useEffect, useState } from 'react';
import type { Vendor } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, Select, SimpleBadge, TableWrap, Toolbar, td, th } from '../components/ui';

export function VendorsPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await store.listVendors());
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

  const filtered = rows.filter((v) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      v.name.toLowerCase().includes(q) ||
      v.contact.toLowerCase().includes(q) ||
      v.tax_code.toLowerCase().includes(q)
    );
  });

  const starColor = (r: number) => (r >= 4 ? '#22c55e' : r === 3 ? '#f59e0b' : '#ef4444');

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo tên, liên hệ, mã số thuế...">
        <Btn primary onClick={() => setShowCreate(true)}>+ Thêm nhà cung cấp</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Nhà cung cấp / Liên hệ</th>
            <th style={th}>Mã số thuế</th>
            <th style={th}>Đánh giá</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((v) => (
            <tr key={v.id}>
              <td style={td}>
                <b style={{ color: C.text }}>{v.name}</b>
                <div style={{ color: C.muted, fontSize: '.78rem' }}>{v.contact || '—'}</div>
              </td>
              <td style={td}>{v.tax_code || '—'}</td>
              <td style={td}>
                <SimpleBadge text={`${'★'.repeat(v.rating)}${'☆'.repeat(5 - v.rating)}`} color={starColor(v.rating)} />
                <Select
                  value={String(v.rating)}
                  onChange={(e) => mutate(() => store!.rateVendor(v.id, Number(e.target.value)))}
                  style={{ marginLeft: '.5rem' }}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n} sao</option>
                  ))}
                </Select>
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <button
                  onClick={() => {
                    if (confirm(`Xóa ${v.name}?`)) mutate(() => store!.removeVendor(v.id));
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
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có nhà cung cấp phù hợp.</p>}
      <p style={{ color: C.muted, fontSize: '.82rem' }}>
        Đánh giá định kỳ qua workflow `wf_vendor_evaluation` (manual). Xóa bị chặn nếu NCC còn hợp đồng.
      </p>

      {showCreate && (
        <CreateForm
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createVendor(v);
              setShowCreate(false);
            })
          }
        />
      )}
    </div>
  );
}

function CreateForm(props: {
  onClose: () => void;
  onSubmit: (v: { name: string; contact: string; rating: number; tax_code: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [rating, setRating] = useState('3');
  const [tax_code, setTax] = useState('');
  return (
    <Modal title="Thêm nhà cung cấp" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Tên nhà cung cấp" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Liên hệ (email / SĐT)" value={contact} onChange={(e) => setContact(e.target.value)} />
        <Input placeholder="Mã số thuế" value={tax_code} onChange={(e) => setTax(e.target.value)} />
        <Select value={rating} onChange={(e) => setRating(e.target.value)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n} sao</option>
          ))}
        </Select>
        <Btn
          primary
          disabled={!name.trim()}
          onClick={() =>
            props.onSubmit({ name: name.trim(), contact, rating: Number(rating) || 3, tax_code })
          }
        >
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}
