// Finance Module — Giao dịch: search/filter + CRUD thu chi.
import React, { useCallback, useEffect, useState } from 'react';
import { formatVND, type FinanceAccount, type FinanceTransaction, type TxnType } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, Select, SimpleBadge, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

export function TransactionsPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<FinanceTransaction[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>(ALL);
  const [account, setAccount] = useState<string>(ALL);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [t, a] = await Promise.all([store.listTransactions(), store.listAccounts()]);
      setRows(t);
      setAccounts(a);
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

  const accName = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.code} — ${a.name}` : '—';
  };

  const filtered = rows.filter((t) => {
    const q = search.trim().toLowerCase();
    const hit =
      !q ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q);
    return hit && (type === ALL || t.type === type) && (account === ALL || t.account_id === account);
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo nội dung, danh mục...">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value={ALL}>Thu + Chi</option>
          <option value="CREDIT">Thu</option>
          <option value="DEBIT">Chi</option>
        </Select>
        <Select value={account} onChange={(e) => setAccount(e.target.value)}>
          <option value={ALL}>Mọi tài khoản</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
          ))}
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Thêm giao dịch</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Ngày / Danh mục</th>
            <th style={th}>Tài khoản</th>
            <th style={th}>Số tiền</th>
            <th style={th}>Loại</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t) => (
            <tr key={t.id}>
              <td style={td}>
                <b style={{ color: C.text }}>{t.transaction_date}</b>
                <div>{t.description || '—'}</div>
                <div style={{ color: C.muted, fontSize: '.78rem' }}>{t.category}</div>
              </td>
              <td style={td}>{accName(t.account_id)}</td>
              <td style={{ ...td, fontWeight: 700, color: t.type === 'CREDIT' ? C.green : C.red, whiteSpace: 'nowrap' }}>
                {t.type === 'CREDIT' ? '+' : '−'}{formatVND(t.amount)}
              </td>
              <td style={td}>
                <SimpleBadge text={t.type === 'CREDIT' ? 'Thu' : 'Chi'} color={t.type === 'CREDIT' ? C.green : C.amber} />
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <button onClick={() => setEditing(t)} style={link}>Sửa</button>{' '}
                <button
                  onClick={() => {
                    if (confirm(`Xóa giao dịch ${t.transaction_date} — ${formatVND(t.amount)}?`)) {
                      mutate(() => store!.removeTransaction(t.id));
                    }
                  }}
                  style={{ ...link, color: C.red }}
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có giao dịch phù hợp.</p>}

      {showCreate && (
        <TxnForm
          title="Thêm giao dịch"
          accounts={accounts}
          onClose={() => setShowCreate(false)}
          onSubmit={(v) => mutate(async () => { await store!.createTransaction(v); setShowCreate(false); })}
        />
      )}
      {editing && (
        <TxnForm
          title={`Sửa giao dịch ${editing.transaction_date}`}
          initial={editing}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onSubmit={(v) => mutate(async () => { await store!.updateTransaction(editing.id, v); setEditing(null); })}
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

function TxnForm(props: {
  title: string;
  initial?: FinanceTransaction;
  accounts: FinanceAccount[];
  onClose: () => void;
  onSubmit: (v: Omit<FinanceTransaction, 'id'>) => Promise<void>;
}) {
  const [transaction_date, setDate] = useState(
    props.initial?.transaction_date ?? new Date().toISOString().slice(0, 10),
  );
  const [account_id, setAccount] = useState(
    props.initial?.account_id ?? props.accounts[0]?.id ?? '',
  );
  const [amount, setAmount] = useState(String(props.initial?.amount ?? 0));
  const [type, setType] = useState<TxnType>(props.initial?.type ?? 'DEBIT');
  const [category, setCategory] = useState(props.initial?.category ?? '');
  const [description, setDescription] = useState(props.initial?.description ?? '');
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input type="date" value={transaction_date} onChange={(e) => setDate(e.target.value)} />
        <Select value={account_id} onChange={(e) => setAccount(e.target.value)}>
          {props.accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </Select>
        <Input placeholder="Số tiền (VND)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select value={type} onChange={(e) => setType(e.target.value as TxnType)}>
          <option value="DEBIT">Chi</option>
          <option value="CREDIT">Thu</option>
        </Select>
        <Input placeholder="Danh mục (VD Lương, Bán hàng, Văn phòng...)" value={category} onChange={(e) => setCategory(e.target.value)} />
        <Input placeholder="Diễn giải" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Btn
          primary
          onClick={() =>
            props.onSubmit({
              transaction_date,
              account_id,
              amount: Number(amount) || 0,
              type,
              category: category.trim() || 'Khác',
              description,
              proof_url: props.initial?.proof_url ?? '',
            })
          }
        >
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}
