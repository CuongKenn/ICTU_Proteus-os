// Finance Module — Hóa đơn: theo dõi + tạo (qua workflow) + duyệt thanh toán.
import React, { useCallback, useEffect, useState } from 'react';
import { formatVND, INVOICE_STATUS_LABEL, type FinanceInvoice, type InvoiceStatus } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, Select, SimpleBadge, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

const color = (s: InvoiceStatus) =>
  s === 'PAID' ? '#22c55e' : s === 'OVERDUE' ? '#ef4444' : s === 'CANCELLED' ? '#64748b' : '#f59e0b';

export function InvoicesPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<FinanceInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>(ALL);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await store.listInvoices());
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

  const filtered = rows.filter((i) => {
    const q = search.trim().toLowerCase();
    const hit =
      !q ||
      i.invoice_number.toLowerCase().includes(q) ||
      i.vendor_name.toLowerCase().includes(q);
    return hit && (filter === ALL || i.status === filter);
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo số HĐ, nhà cung cấp...">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value={ALL}>Mọi trạng thái</option>
          <option value="PENDING">Chờ thanh toán</option>
          <option value="PAID">Đã thanh toán</option>
          <option value="OVERDUE">Quá hạn</option>
          <option value="CANCELLED">Đã hủy</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Thêm hóa đơn</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Số HĐ / Nhà cung cấp</th>
            <th style={th}>Số tiền</th>
            <th style={th}>Phát hành / Hạn TT</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Duyệt</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((i) => (
            <tr key={i.id}>
              <td style={td}>
                <b style={{ color: C.text }}>{i.invoice_number}</b>
                <div>{i.vendor_name}</div>
              </td>
              <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{formatVND(i.amount)}</td>
              <td style={td}>
                {i.issue_date}
                <div style={{ color: i.status === 'OVERDUE' ? C.red : C.muted }}>Hạn: {i.due_date}</div>
              </td>
              <td style={td}><SimpleBadge text={INVOICE_STATUS_LABEL[i.status]} color={color(i.status)} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {(i.status === 'PENDING' || i.status === 'OVERDUE') ? (
                  <>
                    <button onClick={() => mutate(() => store!.reviewInvoice(i.id, 'PAID'))} style={ok}>
                      Đã thanh toán
                    </button>{' '}
                    <button onClick={() => mutate(() => store!.reviewInvoice(i.id, 'CANCELLED'))} style={no}>
                      Hủy
                    </button>
                  </>
                ) : (
                  <span style={{ color: C.muted }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có hóa đơn phù hợp.</p>}
      {mode === 'live' && (
        <p style={{ color: C.muted, fontSize: '.78rem' }}>
          Nút “Thêm hóa đơn” gọi workflow n8n `wf_invoice_processing` qua dispatcher (202 → xử lý ngầm).
        </p>
      )}

      {showCreate && (
        <CreateForm
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createInvoice(v);
              setShowCreate(false);
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
  onSubmit: (v: Omit<FinanceInvoice, 'id'>) => Promise<void>;
}) {
  const [invoice_number, setNo] = useState('');
  const [vendor_name, setVendor] = useState('');
  const [amount, setAmount] = useState('0');
  const [issue_date, setIssue] = useState(new Date().toISOString().slice(0, 10));
  const [due_date, setDue] = useState(new Date().toISOString().slice(0, 10));
  return (
    <Modal title="Thêm hóa đơn" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Số hóa đơn (VD HĐ-2026-0091)" value={invoice_number} onChange={(e) => setNo(e.target.value)} />
        <Input placeholder="Nhà cung cấp (VD VNPT Thái Nguyên)" value={vendor_name} onChange={(e) => setVendor(e.target.value)} />
        <Input placeholder="Số tiền (VND)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label style={{ color: C.muted, fontSize: '.8rem' }}>
          Ngày phát hành
          <Input type="date" value={issue_date} onChange={(e) => setIssue(e.target.value)} />
        </label>
        <label style={{ color: C.muted, fontSize: '.8rem' }}>
          Hạn thanh toán
          <Input type="date" value={due_date} onChange={(e) => setDue(e.target.value)} />
        </label>
        <Btn
          primary
          disabled={!invoice_number.trim() || !vendor_name.trim()}
          onClick={() =>
            props.onSubmit({
              invoice_number: invoice_number.trim(),
              vendor_name: vendor_name.trim(),
              amount: Number(amount) || 0,
              issue_date,
              due_date,
              status: 'PENDING',
              file_url: '',
            })
          }
        >
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}
