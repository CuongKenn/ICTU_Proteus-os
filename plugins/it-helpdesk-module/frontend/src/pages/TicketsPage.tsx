// IT Helpdesk Tickets: SLA countdown + chuyển trạng thái + trao đổi + tạo mới.
// Pattern theo mẫu CRM TicketsPage; trạng thái theo migration it_tickets
// (OPEN, IN_PROGRESS, WAITING_ON_USER, RESOLVED, CLOSED).
import React, { useCallback, useEffect, useState } from 'react';
import { PRIORITY_LABEL, TICKET_STATUS_LABEL, type ItCategory, type ItTicket, type TicketStatus, type TicketUpdate } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, Select, SimpleBadge, TableWrap, Toolbar, td, th } from '../components/ui';

const NEXT: Record<TicketStatus, TicketStatus | null> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'WAITING_ON_USER',
  WAITING_ON_USER: 'RESOLVED',
  RESOLVED: 'CLOSED',
  CLOSED: null,
};

function slaInfo(deadline: string, status: TicketStatus): { text: string; color: string } {
  if (['RESOLVED', 'CLOSED'].includes(status)) return { text: 'Done', color: '#22c55e' };
  if (!deadline) return { text: 'Chưa đặt SLA', color: '#64748b' };
  const ms = new Date(deadline).getTime() - Date.now();
  if (Number.isNaN(ms)) return { text: '—', color: '#64748b' };
  if (ms < 0) return { text: `Quá ${Math.ceil(-ms / 3600000)}h`, color: '#ef4444' };
  if (ms < 86400000) return { text: `Còn ${Math.ceil(ms / 3600000)}h`, color: '#f59e0b' };
  return { text: `Còn ${Math.ceil(ms / 86400000)}d`, color: '#38bdf8' };
}

const pColor = (p: string) => (p === 'P1' ? '#ef4444' : p === 'P2' ? '#f59e0b' : '#38bdf8');

export function TicketsPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<ItTicket[]>([]);
  const [cats, setCats] = useState<ItCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Record<string, TicketUpdate[]>>({});
  const [draft, setDraft] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [t, c] = await Promise.all([store.listTickets(), store.listCategories()]);
      setRows(t);
      setCats(c);
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

  const toggleUpdates = async (tid: string) => {
    if (openId === tid) {
      setOpenId(null);
      return;
    }
    setOpenId(tid);
    if (!store || updates[tid]) return;
    try {
      const list = await store.listUpdates(tid);
      setUpdates((m) => ({ ...m, [tid]: list }));
    } catch (e) {
      setError(errText(e));
    }
  };

  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? '—';
  const filtered = rows.filter((t) => {
    const q = search.trim().toLowerCase();
    return (
      (!q || t.title.toLowerCase().includes(q) || t.requester_name.toLowerCase().includes(q)) &&
      (filter === 'ALL' || t.status === filter)
    );
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo tiêu đề, người yêu cầu...">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">Mọi trạng thái</option>
          <option value="OPEN">Mới</option>
          <option value="IN_PROGRESS">Đang xử lý</option>
          <option value="WAITING_ON_USER">Chờ người dùng</option>
          <option value="RESOLVED">Đã giải quyết</option>
          <option value="CLOSED">Đóng</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Tạo ticket</Btn>
      </Toolbar>
      {mode === 'live' && (
        <p style={{ color: C.muted, fontSize: '.78rem' }}>
          “Tạo ticket” gọi workflow `wf_ticket_create` (tạo + phân công + nhắn).
        </p>
      )}

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Ticket</th>
            <th style={th}>Ưu tiên</th>
            <th style={th}>SLA</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Next</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t) => {
            const sla = slaInfo(t.sla_deadline, t.status);
            const next = NEXT[t.status];
            return (
              <React.Fragment key={t.id}>
                <tr>
                  <td style={td}>
                    <b style={{ cursor: 'pointer', color: C.text }} onClick={() => toggleUpdates(t.id)}>
                      {t.title}
                    </b>
                    <div style={{ color: C.muted, fontSize: '.78rem' }}>
                      {catName(t.category_id)} · {t.requester_name}
                      {t.assignee_name ? ` · → ${t.assignee_name}` : ' · chưa gán'}
                      {t.escalated ? ' · ⚠ escalated' : ''}
                    </div>
                  </td>
                  <td style={td}><SimpleBadge text={t.priority} color={pColor(t.priority)} /></td>
                  <td style={td}><SimpleBadge text={sla.text} color={sla.color} /></td>
                  <td style={td}>{TICKET_STATUS_LABEL[t.status]}</td>
                  <td style={td}>
                    {next && (
                      <button
                        onClick={() => mutate(() => store!.moveTicket(t.id, next))}
                        style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer' }}
                      >
                        → {TICKET_STATUS_LABEL[next]}
                      </button>
                    )}
                  </td>
                </tr>
                {openId === t.id && (
                  <tr>
                    <td style={{ ...td, background: '#0b1220' }} colSpan={5}>
                      <div style={{ color: C.muted, fontSize: '.85rem', marginBottom: '.5rem' }}>{t.description}</div>
                      {(updates[t.id] ?? []).map((u) => (
                        <div key={u.id} style={{ color: C.text, fontSize: '.85rem', padding: '.25rem 0' }}>
                          <b>{u.user_name}:</b> {u.message}
                          {u.new_status && (
                            <span style={{ color: C.muted }}> (→ {u.new_status})</span>
                          )}
                          <span style={{ color: C.muted, fontSize: '.75rem' }}>
                            {' '}· {String(u.created_at).slice(0, 16).replace('T', ' ')}
                          </span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
                        <Input
                          placeholder="Thêm trao đổi..."
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                        />
                        <Btn
                          onClick={() =>
                            mutate(async () => {
                              if (!draft.trim()) return;
                              const u = await store!.addUpdate(t.id, 'Bạn', draft.trim());
                              setUpdates((m) => ({ ...m, [t.id]: [...(m[t.id] ?? []), u] }));
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
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có ticket phù hợp.</p>}

      {showCreate && (
        <CreateTicket
          categories={cats.map((c) => ({ id: c.id, name: c.name }))}
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
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (v: {
    category_id: string;
    title: string;
    description: string;
    priority: 'P1' | 'P2' | 'P3' | 'P4';
    requester_name: string;
  }) => Promise<void>;
}) {
  const [category_id, setCat] = useState(props.categories[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDesc] = useState('');
  const [priority, setPriority] = useState<'P1' | 'P2' | 'P3' | 'P4'>('P3');
  const [requester_name, setRequester] = useState('');
  return (
    <Modal title="Tạo ticket" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input
          placeholder="Người yêu cầu (VD Nguyễn Văn An · Phòng Kỹ thuật)"
          value={requester_name}
          onChange={(e) => setRequester(e.target.value)}
        />
        <Select value={category_id} onChange={(e) => setCat(e.target.value)}>
          {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input placeholder="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Mô tả chi tiết" value={description} onChange={(e) => setDesc(e.target.value)} />
        <Select value={priority} onChange={(e) => setPriority(e.target.value as 'P1' | 'P2' | 'P3' | 'P4')}>
          {(['P1', 'P2', 'P3', 'P4'] as const).map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </Select>
        <Btn
          primary
          disabled={!title.trim()}
          onClick={() =>
            props.onSubmit({
              category_id,
              title: title.trim(),
              description: description.trim() || title.trim(),
              priority,
              requester_name: requester_name.trim() || 'Chưa rõ',
            })
          }
        >
          Gửi
        </Btn>
      </div>
    </Modal>
  );
}
