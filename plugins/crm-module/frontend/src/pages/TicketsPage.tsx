// CRM Tickets: SLA countdown + chuyển trạng thái + comments + tạo mới.
import React, { useCallback, useEffect, useState } from 'react';
import type { Customer, Ticket, TicketStatus } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, Pill, Select, td, th } from '../components/ui';

const NEXT: Record<TicketStatus, TicketStatus | null> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'WAITING_ON_CUSTOMER',
  WAITING_ON_CUSTOMER: 'RESOLVED',
  RESOLVED: 'CLOSED',
  CLOSED: null,
};

function slaInfo(deadline: string, status: TicketStatus): { text: string; color: string } {
  if (['RESOLVED', 'CLOSED'].includes(status)) return { text: 'Done', color: '#22c55e' };
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) return { text: `Quá ${Math.ceil(-ms / 3600000)}h`, color: '#ef4444' };
  if (ms < 86400000) return { text: `Còn ${Math.ceil(ms / 3600000)}h`, color: '#f59e0b' };
  return { text: `Còn ${Math.ceil(ms / 86400000)}d`, color: '#38bdf8' };
}

const pColor = (p: string) => (p === 'P1' ? '#ef4444' : p === 'P2' ? '#f59e0b' : '#38bdf8');

export function TicketsPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<Ticket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, { user: string; content: string }[]>>({});
  const [draft, setDraft] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [t, c] = await Promise.all([store.listTickets(), store.listCustomers()]);
      setRows(t);
      setCustomers(c);
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

  const toggleComments = async (tid: string) => {
    if (openId === tid) {
      setOpenId(null);
      return;
    }
    setOpenId(tid);
    if (!store || comments[tid]) return;
    try {
      const list = await store.listComments(tid);
      setComments((m) => ({ ...m, [tid]: list }));
    } catch (e) {
      setError(errText(e));
    }
  };

  const custName = (id: string) => customers.find((c) => c.id === id)?.name ?? '—';
  const filtered = rows.filter((t) => filter === 'ALL' || t.status === filter);

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">Mọi trạng thái</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="WAITING_ON_CUSTOMER">WAITING</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="CLOSED">CLOSED</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Tạo ticket</Btn>
      </div>
      {mode === 'live' && (
        <p style={{ color: C.muted, fontSize: '.78rem' }}>
          “Tạo ticket” gọi workflow `wf_ticket_assignment` (tìm agent → gán → nhắn).
        </p>
      )}
      <div style={{ overflowX: 'auto', border: '1px solid #334155', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e2e8f0', fontSize: '.88rem' }}>
          <thead><tr><th style={th}>Ticket</th><th style={th}>Ưu tiên</th><th style={th}>SLA</th><th style={th}>Trạng thái</th><th style={th}>Next</th></tr></thead>
          <tbody>
            {filtered.map((t) => {
              const sla = slaInfo(t.sla_deadline, t.status);
              const next = NEXT[t.status];
              return (
                <React.Fragment key={t.id}>
                  <tr>
                    <td style={td}>
                      <b style={{ cursor: 'pointer' }} onClick={() => toggleComments(t.id)}>{t.title}</b>
                      <div style={{ color: '#94a3b8', fontSize: '.78rem' }}>{custName(t.customer_id)} · {t.assignee}</div>
                    </td>
                    <td style={td}><Pill text={t.priority} color={pColor(t.priority)} /></td>
                    <td style={td}><Pill text={sla.text} color={sla.color} /></td>
                    <td style={td}>{t.status}</td>
                    <td style={td}>
                      {next && <button onClick={() => mutate(() => store!.moveTicket(t.id, next))} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer' }}>→ {next}</button>}
                    </td>
                  </tr>
                  {openId === t.id && (
                    <tr>
                      <td style={{ ...td, background: '#0b1220' }} colSpan={5}>
                        <div style={{ color: '#94a3b8', fontSize: '.85rem', marginBottom: '.5rem' }}>{t.description}</div>
                        {(comments[t.id] ?? []).map((c, i) => (
                          <div key={i} style={{ color: '#e2e8f0', fontSize: '.85rem', padding: '.25rem 0' }}>
                            <b>{c.user}:</b> {c.content}
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
                          <Input placeholder="Thêm bình luận..." value={draft} onChange={(e) => setDraft(e.target.value)} />
                          <Btn
                            onClick={() =>
                              mutate(async () => {
                                if (!draft.trim()) return;
                                const c = await store!.addComment(t.id, 'Bạn', draft.trim());
                                setComments((m) => ({ ...m, [t.id]: [...(m[t.id] ?? []), c] }));
                                setDraft('');
                              })
                            }
                          >
                            Gửi
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {showCreate && (
        <CreateTicket
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createTicket(v);
              setShowCreate(false);
            })
          }
        />
      )}
    </div>
  );
}

function CreateTicket(props: {
  customers: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (v: { customer_id: string; title: string; description: string; priority: 'P1' | 'P2' | 'P3' | 'P4' }) => Promise<void>;
}) {
  const [customer_id, setCust] = useState(props.customers[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDesc] = useState('');
  const [priority, setPriority] = useState<'P1' | 'P2' | 'P3' | 'P4'>('P3');
  return (
    <Modal title="Tạo ticket" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Select value={customer_id} onChange={(e) => setCust(e.target.value)}>
          {props.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input placeholder="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Mô tả" value={description} onChange={(e) => setDesc(e.target.value)} />
        <Select value={priority} onChange={(e) => setPriority(e.target.value as 'P1' | 'P2' | 'P3' | 'P4')}>
          <option value="P1">P1 Critical</option>
          <option value="P2">P2 High</option>
          <option value="P3">P3 Normal</option>
          <option value="P4">P4 Low</option>
        </Select>
        <Btn primary onClick={() => props.onSubmit({ customer_id, title, description, priority })}>Gửi</Btn>
      </div>
    </Modal>
  );
}
