// IT Helpdesk Module — Tổng quan: KPI + SLA vi phạm + tickets mới + top tri thức.
import React, { useEffect, useState } from 'react';
import type { ItTicket, KnowledgeArticle } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { C, DataSourceBar, InlineError, SimpleBadge, StatCard, TableWrap, td, th } from '../components/ui';

export function Dashboard() {
  const { mode, store, reason, message } = useStore();
  const [tickets, setTickets] = useState<ItTicket[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [t, k] = await Promise.all([store.listTickets(), store.listKnowledge()]);
        if (!cancelled) {
          setTickets(t);
          setKnowledge(k);
        }
      } catch (e) {
        if (!cancelled) setError(errText(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store]);

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  const open = tickets.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status));
  const breached = open.filter((t) => t.sla_deadline && new Date(t.sla_deadline).getTime() < Date.now());
  const done = tickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status));
  const rated = tickets.filter((t) => t.feedback_rating != null);
  const avgRating = rated.length
    ? (rated.reduce((s, t) => s + (t.feedback_rating ?? 0), 0) / rated.length).toFixed(1)
    : '—';
  const newest = [...tickets]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 5);
  const topKb = [...knowledge]
    .filter((k) => k.is_published)
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 5);

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <StatCard label="Tickets đang mở" value={String(open.length)} sub={`${tickets.length} tickets tổng`} />
        <StatCard label="Vi phạm SLA" value={String(breached.length)} sub="quá hạn chưa đóng" />
        <StatCard label="Đã giải quyết" value={String(done.length)} sub="resolved + closed" />
        <StatCard label="Hài lòng trung bình" value={`${avgRating}/5`} sub={`${rated.length} lượt đánh giá`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '.75rem' }}>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
          <h4 style={{ margin: '0 0 .75rem 0', color: C.text }}>Tickets mới nhất</h4>
          <TableWrap>
            <thead>
              <tr>
                <th style={th}>Tiêu đề</th>
                <th style={th}>Ưu tiên</th>
                <th style={th}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {newest.map((t) => (
                <tr key={t.id}>
                  <td style={td}>
                    <b>{t.title}</b>
                    <div style={{ color: C.muted, fontSize: '.78rem' }}>{t.requester_name}</div>
                  </td>
                  <td style={td}>
                    <SimpleBadge text={t.priority} color={pColor(t.priority)} />
                  </td>
                  <td style={td}>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
          <h4 style={{ margin: '0 0 .75rem 0', color: C.text }}>Bài viết được xem nhiều</h4>
          <TableWrap>
            <thead>
              <tr>
                <th style={th}>Bài viết</th>
                <th style={th}>Lượt xem</th>
              </tr>
            </thead>
            <tbody>
              {topKb.map((k) => (
                <tr key={k.id}>
                  <td style={td}>{k.title}</td>
                  <td style={td}>{k.view_count}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <div style={{ color: C.muted, fontSize: '.78rem', marginTop: '.5rem' }}>
            SLA theo `it_sla_policies` + workflow `wf_sla_escalation` (cron 30 phút).
          </div>
        </div>
      </div>
    </div>
  );
}

function pColor(p: string): string {
  return p === 'P1' ? '#ef4444' : p === 'P2' ? '#f59e0b' : '#38bdf8';
}
