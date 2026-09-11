// CRM Dashboard: pipeline weighted + lead source + SLA.
import React, { useEffect, useState } from 'react';
import type { Lead, Opportunity, Ticket } from '../types';
import { formatVND } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { C, DataSourceBar, InlineError, StatCard } from '../components/ui';

const OPEN_STAGES = ['PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION'];

export function Dashboard() {
  const { mode, store, reason, message } = useStore();
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [o, l, t] = await Promise.all([
          store.listOpportunities(),
          store.listLeads(),
          store.listTickets(),
        ]);
        if (!cancelled) {
          setOpps(o);
          setLeads(l);
          setTickets(t);
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

  const open = opps.filter((o) => OPEN_STAGES.includes(o.stage));
  const weighted = open.reduce((s, o) => s + (o.value * o.probability_pct) / 100, 0);
  const won = opps.filter((o) => o.stage === 'CLOSED_WON').reduce((s, o) => s + o.value, 0);
  const breached = tickets.filter((t) => t.sla_deadline < new Date().toISOString() && !['RESOLVED', 'CLOSED'].includes(t.status)).length;

  const bySource = leads.reduce<Record<string, number>>((a, l) => {
    a[l.source] = (a[l.source] ?? 0) + 1;
    return a;
  }, {});

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <StatCard label="Giá trị kỳ vọng" value={formatVND(weighted)} sub={`${open.length} cơ hội open`} />
        <StatCard label="Đã thắng" value={formatVND(won)} />
        <StatCard label="Lead mới" value={String(leads.filter((l) => l.stage === 'NEW').length)} sub={`tổng ${leads.length}`} />
        <StatCard label="Ticket quá SLA" value={String(breached)} sub={`tổng ${tickets.length}`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '.75rem' }}>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
          <h4 style={{ margin: '0 0 .75rem 0', color: C.text }}>Phễu pipeline (open)</h4>
          {OPEN_STAGES.map((st) => {
            const rows = open.filter((o) => o.stage === st);
            const sum = rows.reduce((s, o) => s + o.value, 0);
            return (
              <div key={st} style={{ display: 'flex', justifyContent: 'space-between', padding: '.4rem 0', borderBottom: '1px solid #0b1220', color: C.text, fontSize: '.88rem' }}>
                <span>{st} ({rows.length})</span>
                <b>{formatVND(sum)}</b>
              </div>
            );
          })}
        </div>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
          <h4 style={{ margin: '0 0 .75rem 0', color: C.text }}>Lead theo nguồn</h4>
          {Object.entries(bySource).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '.4rem 0', borderBottom: '1px solid #0b1220', color: C.text, fontSize: '.88rem' }}>
              <span>{k}</span><b>{v}</b>
            </div>
          ))}
          <div style={{ color: C.muted, fontSize: '.78rem', marginTop: '.5rem' }}>
            Map với `dashboards/sales_pipeline.json` + `workflows/lead_capture.json`.
          </div>
        </div>
      </div>
    </div>
  );
}
