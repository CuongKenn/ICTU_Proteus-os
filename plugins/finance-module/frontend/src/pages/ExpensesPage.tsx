// Finance Module — Đề xuất chi: tạo (qua workflow) + duyệt/từ chối.
import React, { useCallback, useEffect, useState } from 'react';
import { formatVND, type ExpenseRequest } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Badge, Btn, C, DataSourceBar, InlineError, Input, Modal, Select, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

export function ExpensesPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<ExpenseRequest[]>([]);
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
      setRows(await store.listExpenses());
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

  const filtered = rows.filter((e) => {
    const q = search.trim().toLowerCase();
    const hit =
      !q ||
      e.requester_name.toLowerCase().includes(q) ||
      e.reason.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q);
    return hit && (filter === ALL || e.status === filter);
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo người đề xuất, lý do...">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value={ALL}>Mọi trạng thái</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Đề xuất chi</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Người đề xuất / Danh mục</th>
            <th style={th}>Lý do</th>
            <th style={th}>Số tiền</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Duyệt</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((e) => (
            <tr key={e.id}>
              <td style={td}>
                <b style={{ color: C.text }}>{e.requester_name}</b>
                <div style={{ color: C.muted, fontSize: '.78rem' }}>
                  {e.category} · {String(e.created_at).slice(0, 10)}
                </div>
              </td>
              <td style={td}>{e.reason}</td>
              <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{formatVND(e.amount)}</td>
              <td style={td}><Badge status={e.status} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {e.status === 'PENDING' ? (
                  <>
                    <button onClick={() => mutate(() => store!.reviewExpense(e.id, 'APPROVED'))} style={ok}>
                      Duyệt
                    </button>{' '}
                    <button onClick={() => mutate(() => store!.reviewExpense(e.id, 'REJECTED'))} style={no}>
                      Từ chối
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
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có đề xuất phù hợp.</p>}
      {mode === 'live' && (
        <p style={{ color: C.muted, fontSize: '.78rem' }}>
          Nút “Đề xuất chi” gọi workflow n8n `wf_expense_approval` qua dispatcher (202 → xử lý ngầm, tự nhắn người duyệt).
        </p>
      )}

      {showCreate && (
        <CreateForm
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createExpense(v);
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
  onSubmit: (v: { requester_id: string; requester_name: string; amount: number; category: string; reason: string }) => Promise<void>;
}) {
  const [requester, setRequester] = useState('');
  const [amount, setAmount] = useState('0');
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  return (
    <Modal title="Đề xuất chi" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Người đề xuất (VD Nguyễn Văn An)" value={requester} onChange={(e) => setRequester(e.target.value)} />
        <Input placeholder="Số tiền (VND)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input placeholder="Danh mục (VD Công tác, Thiết bị...)" value={category} onChange={(e) => setCategory(e.target.value)} />
        <Input placeholder="Lý do chi" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Btn
          primary
          disabled={!requester.trim() || !reason.trim()}
          onClick={() =>
            props.onSubmit({
              requester_id: requester.trim(),
              requester_name: requester.trim(),
              amount: Number(amount) || 0,
              category: category.trim() || 'Khác',
              reason: reason.trim(),
            })
          }
        >
          Gửi đề xuất
        </Btn>
      </div>
    </Modal>
  );
}
