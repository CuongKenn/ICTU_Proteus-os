// Procurement Module — Đề xuất mua hàng + PO: tạo mới + duyệt/từ chối.
import React, { useCallback, useEffect, useState } from 'react';
import { PO_STATUS_LABEL, REQUEST_STATUS_LABEL, formatVND, type Contract, type PurchaseOrder, type PurchaseRequest } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Badge, Btn, C, DataSourceBar, InlineError, Input, Modal, Select, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

export function RequestsPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<PurchaseRequest[]>([]);
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(ALL);
  const [showCreate, setShowCreate] = useState(false);
  const [showPO, setShowPO] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [rq, po, ct] = await Promise.all([store.listRequests(), store.listPOs(), store.listContracts()]);
      setRows(rq);
      setPOs(po);
      setContracts(ct);
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
    return (
      (!q || r.item_name.toLowerCase().includes(q) || r.requester_name.toLowerCase().includes(q)) &&
      (filter === ALL || r.status === filter)
    );
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo hạng mục, người đề xuất...">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value={ALL}>Mọi trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="submitted">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Từ chối</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Tạo đề xuất</Btn>
      </Toolbar>
      {mode === 'live' && (
        <p style={{ color: C.muted, fontSize: '.78rem' }}>
          “Tạo đề xuất” gọi workflow n8n `wf_purchase_request` qua dispatcher (202 → xử lý ngầm).
        </p>
      )}

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Hạng mục / Người đề xuất</th>
            <th style={th}>SL × Ước tính</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Duyệt</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td style={td}>
                <b style={{ color: C.text }}>{r.item_name}</b>
                <div style={{ color: C.muted, fontSize: '.78rem' }}>
                  {r.requester_name} · {String(r.created_at).slice(0, 10)}
                </div>
              </td>
              <td style={td}>×{r.quantity} · {formatVND(r.estimated_cost)}</td>
              <td style={td}><Badge text={REQUEST_STATUS_LABEL[r.status]} status={r.status} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {r.status === 'submitted' || r.status === 'draft' ? (
                  <>
                    <button onClick={() => mutate(() => store!.reviewRequest(r.id, 'approved'))} style={ok}>Duyệt</button>{' '}
                    <button onClick={() => mutate(() => store!.reviewRequest(r.id, 'rejected'))} style={no}>Từ chối</button>
                  </>
                ) : (
                  <span style={{ color: C.muted }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có đề xuất phù hợp.</p>}

      <h3 style={{ color: C.text, margin: '1.5rem 0 .75rem' }}>
        Đơn đặt hàng (PO)
        <Btn onClick={() => setShowPO(true)} style={{ marginLeft: '.75rem' }}>+ Tạo PO</Btn>
      </h3>
      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Nội dung</th>
            <th style={th}>Tổng tiền / Giao hàng</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Duyệt</th>
          </tr>
        </thead>
        <tbody>
          {pos.map((p) => (
            <tr key={p.id}>
              <td style={td}>
                {p.items_summary}
                <div style={{ color: C.muted, fontSize: '.78rem' }}>HĐ: {p.contract_id.slice(0, 8)}…</div>
              </td>
              <td style={td}>{formatVND(p.total_amount)} · {p.delivery_date || '—'}</td>
              <td style={td}><Badge text={PO_STATUS_LABEL[p.status]} status={p.status} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {p.status === 'pending' ? (
                  <>
                    <button onClick={() => mutate(() => store!.reviewPO(p.id, 'approved'))} style={ok}>Duyệt</button>{' '}
                    <button onClick={() => mutate(() => store!.reviewPO(p.id, 'rejected'))} style={no}>Từ chối</button>
                  </>
                ) : (
                  <span style={{ color: C.muted }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {mode === 'live' && (
        <p style={{ color: C.muted, fontSize: '.78rem' }}>
          Nút “Duyệt/Từ chối” PO gọi workflow `wf_po_approval` qua dispatcher.
        </p>
      )}

      {showCreate && (
        <CreateForm
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createRequest(v);
              setShowCreate(false);
            })
          }
        />
      )}
      {showPO && (
        <POForm
          contracts={contracts.filter((c) => c.status === 'active' || c.status === 'draft')}
          onClose={() => setShowPO(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createPO(v);
              setShowPO(false);
            })
          }
        />
      )}
    </div>
  );
}

const ok: React.CSSProperties = { background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer' };
const no: React.CSSProperties = { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' };

function CreateForm(props: {
  onClose: () => void;
  onSubmit: (v: { requester_name: string; item_name: string; quantity: number; estimated_cost: number; status: 'submitted' }) => Promise<void>;
}) {
  const [requester_name, setRequester] = useState('');
  const [item_name, setItem] = useState('');
  const [quantity, setQty] = useState('1');
  const [cost, setCost] = useState('0');
  return (
    <Modal title="Tạo đề xuất mua hàng" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Người đề xuất / Phòng ban (VD Nguyễn Văn An · Phòng Kỹ thuật)" value={requester_name} onChange={(e) => setRequester(e.target.value)} />
        <Input placeholder="Hạng mục (VD Laptop Dell x10)" value={item_name} onChange={(e) => setItem(e.target.value)} />
        <Input placeholder="Số lượng" value={quantity} onChange={(e) => setQty(e.target.value)} />
        <Input placeholder="Chi phí ước tính (VND)" value={cost} onChange={(e) => setCost(e.target.value)} />
        <Btn
          primary
          disabled={!item_name.trim()}
          onClick={() =>
            props.onSubmit({
              requester_name: requester_name.trim() || 'Chưa rõ',
              item_name: item_name.trim(),
              quantity: Number(quantity) || 1,
              estimated_cost: Number(cost) || 0,
              status: 'submitted',
            })
          }
        >
          Gửi đề xuất
        </Btn>
      </div>
    </Modal>
  );
}

function POForm(props: {
  contracts: Contract[];
  onClose: () => void;
  onSubmit: (v: { contract_id: string; items_summary: string; total_amount: number; delivery_date: string; status: 'pending' }) => Promise<void>;
}) {
  const [contract_id, setContract] = useState(props.contracts[0]?.id ?? '');
  const [items_summary, setItems] = useState('');
  const [total, setTotal] = useState('0');
  const [delivery_date, setDate] = useState('');
  return (
    <Modal title="Tạo đơn đặt hàng (PO)" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Select value={contract_id} onChange={(e) => setContract(e.target.value)}>
          {props.contracts.map((c) => (
            <option key={c.id} value={c.id}>
              HĐ {c.id.slice(0, 8)}… · {formatVND(c.value)}
            </option>
          ))}
        </Select>
        <Input placeholder="Nội dung hàng hóa (VD Laptop x10)" value={items_summary} onChange={(e) => setItems(e.target.value)} />
        <Input placeholder="Tổng tiền (VND)" value={total} onChange={(e) => setTotal(e.target.value)} />
        <Input type="date" value={delivery_date} onChange={(e) => setDate(e.target.value)} />
        <Btn
          primary
          disabled={!contract_id || !items_summary.trim()}
          onClick={() =>
            props.onSubmit({
              contract_id,
              items_summary: items_summary.trim(),
              total_amount: Number(total) || 0,
              delivery_date,
              status: 'pending',
            })
          }
        >
          Tạo PO
        </Btn>
      </div>
    </Modal>
  );
}
