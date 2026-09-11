// Procurement Module — Hợp đồng: theo dõi hiệu lực/hết hạn + CRUD.
import React, { useCallback, useEffect, useState } from 'react';
import { CONTRACT_STATUS_LABEL, formatVND, type Contract, type ContractStatus, type Vendor } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Badge, Btn, C, DataSourceBar, InlineError, Input, Modal, Select, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

export function ContractsPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<Contract[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(ALL);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [ct, vd] = await Promise.all([store.listContracts(), store.listVendors()]);
      setRows(ct);
      setVendors(vd);
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

  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? id.slice(0, 8);
  const filtered = rows.filter((c) => {
    const q = search.trim().toLowerCase();
    return (!q || vendorName(c.vendor_id).toLowerCase().includes(q)) && (filter === ALL || c.status === filter);
  });

  const daysLeft = (end: string) =>
    Math.ceil((new Date(`${end}T00:00:00Z`).getTime() - Date.now()) / 86400000);

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo nhà cung cấp...">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value={ALL}>Mọi trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="active">Hiệu lực</option>
          <option value="expired">Hết hạn</option>
          <option value="terminated">Thanh lý</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Thêm hợp đồng</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Nhà cung cấp</th>
            <th style={th}>Giá trị / Thời hạn</th>
            <th style={th}>Còn lại</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Cập nhật</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => {
            const left = daysLeft(c.end_date);
            return (
              <tr key={c.id}>
                <td style={td}>
                  <b style={{ color: C.text }}>{vendorName(c.vendor_id)}</b>
                  <div style={{ color: C.muted, fontSize: '.78rem' }}>HĐ {c.id.slice(0, 8)}…</div>
                </td>
                <td style={td}>
                  {formatVND(c.value)}
                  <div style={{ color: C.muted, fontSize: '.78rem' }}>{c.start_date} → {c.end_date}</div>
                </td>
                <td style={{ ...td, color: left < 0 ? C.red : left <= 30 ? C.amber : C.text }}>
                  {left < 0 ? `Quá ${-left} ngày` : `Còn ${left} ngày`}
                </td>
                <td style={td}><Badge text={CONTRACT_STATUS_LABEL[c.status]} status={c.status} /></td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  <Select
                    value={c.status}
                    onChange={(e) => mutate(() => store!.updateContractStatus(c.id, e.target.value as ContractStatus))}
                  >
                    <option value="draft">Nháp</option>
                    <option value="active">Hiệu lực</option>
                    <option value="expired">Hết hạn</option>
                    <option value="terminated">Thanh lý</option>
                  </Select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có hợp đồng phù hợp.</p>}

      {showCreate && (
        <CreateForm
          vendors={vendors.map((v) => ({ id: v.id, name: v.name }))}
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createContract(v);
              setShowCreate(false);
            })
          }
        />
      )}
    </div>
  );
}

function CreateForm(props: {
  vendors: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: (v: { vendor_id: string; value: number; start_date: string; end_date: string; status: ContractStatus }) => Promise<void>;
}) {
  const [vendor_id, setVendor] = useState(props.vendors[0]?.id ?? '');
  const [value, setValue] = useState('0');
  const [start_date, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end_date, setEnd] = useState('');
  return (
    <Modal title="Thêm hợp đồng" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Select value={vendor_id} onChange={(e) => setVendor(e.target.value)}>
          {props.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </Select>
        <Input placeholder="Giá trị (VND)" value={value} onChange={(e) => setValue(e.target.value)} />
        <Input type="date" value={start_date} onChange={(e) => setStart(e.target.value)} />
        <Input type="date" value={end_date} onChange={(e) => setEnd(e.target.value)} />
        <Btn
          primary
          disabled={!vendor_id || !end_date}
          onClick={() =>
            props.onSubmit({
              vendor_id,
              value: Number(value) || 0,
              start_date,
              end_date,
              status: 'draft',
            })
          }
        >
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}
