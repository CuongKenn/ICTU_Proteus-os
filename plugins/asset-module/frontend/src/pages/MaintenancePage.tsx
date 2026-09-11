// Asset Module — Bảo trì: lịch sử + thêm log + theo dõi hạn.
import React, { useCallback, useEffect, useState } from 'react';
import type { AssetItem, MaintenanceLog, MaintenanceType } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, Select, TableWrap, Toolbar, td, th } from '../components/ui';

export function MaintenancePage() {
  const { mode, store, reason, message } = useStore();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [lg, it] = await Promise.all([store.listMaintenance(), store.listItems()]);
      setLogs(lg);
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

  const nameOf = (id: string) => {
    const it = items.find((i) => i.id === id);
    return it ? `${it.code} — ${it.name}` : id;
  };
  const filtered = logs.filter(
    (m) => !search.trim() || nameOf(m.asset_id).toLowerCase().includes(search.trim().toLowerCase()),
  );

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo mã tài sản...">
        <Btn primary onClick={() => setShowAdd(true)}>+ Thêm lịch sử bảo trì</Btn>
      </Toolbar>
      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Tài sản</th>
            <th style={th}>Loại</th>
            <th style={th}>Kỹ thuật / Chi phí</th>
            <th style={th}>Thực hiện / Hạn tới</th>
            <th style={th}>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((m) => (
            <tr key={m.id}>
              <td style={td}>{nameOf(m.asset_id)}</td>
              <td style={td}>{m.type === 'REPAIR' ? 'Sửa chữa' : 'Định kỳ'}</td>
              <td style={td}>
                {m.technician}
                <div style={{ color: C.muted }}>{new Intl.NumberFormat('vi-VN').format(m.cost)} đ</div>
              </td>
              <td style={td}>
                {String(m.done_at).slice(0, 10)}
                <div style={{ color: m.next_due < new Date().toISOString().slice(0, 10) ? C.red : C.muted }}>
                  Hạn: {m.next_due}
                </div>
              </td>
              <td style={td}>{m.notes}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {showAdd && (
        <AddLog
          assets={items.map((i) => ({ id: i.id, label: `${i.code} — ${i.name}` }))}
          onClose={() => setShowAdd(false)}
          onSubmit={async (v) => {
            setError(null);
            try {
              await store!.addMaintenance(v);
              setShowAdd(false);
              await load();
            } catch (e) {
              setError(errText(e));
            }
          }}
        />
      )}
    </div>
  );
}

function AddLog(props: {
  assets: Array<{ id: string; label: string }>;
  onClose: () => void;
  onSubmit: (v: { asset_id: string; type: MaintenanceType; technician: string; cost: number; done_at: string; next_due: string; notes: string }) => Promise<void>;
}) {
  const [asset_id, setAsset] = useState(props.assets[0]?.id ?? '');
  const [type, setType] = useState<MaintenanceType>('ROUTINE');
  const [technician, setTech] = useState('');
  const [cost, setCost] = useState('0');
  const [next_due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <Modal title="Thêm lịch sử bảo trì" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Select value={asset_id} onChange={(e) => setAsset(e.target.value)}>
          {props.assets.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value as MaintenanceType)}>
          <option value="ROUTINE">Định kỳ</option>
          <option value="REPAIR">Sửa chữa</option>
        </Select>
        <Input placeholder="Kỹ thuật viên" value={technician} onChange={(e) => setTech(e.target.value)} />
        <Input placeholder="Chi phí (VND)" value={cost} onChange={(e) => setCost(e.target.value)} />
        <Input type="date" value={next_due} onChange={(e) => setDue(e.target.value)} />
        <Input placeholder="Ghi chú" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Btn
          primary
          onClick={() =>
            props.onSubmit({
              asset_id,
              type,
              technician,
              cost: Number(cost) || 0,
              done_at: new Date().toISOString(),
              next_due: next_due || new Date().toISOString().slice(0, 10),
              notes,
            })
          }
        >
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}
