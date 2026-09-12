// CRM Opportunities kanban + probability.
import React, { useCallback, useEffect, useState } from 'react';
import type { Customer, Opportunity } from '../types';
import { OPP_STAGES, formatVND } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { C, DataSourceBar, InlineError, Pill } from '../components/ui';

export function OpportunitiesPage() {
  const { mode, store, reason, message } = useStore();
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [o, c] = await Promise.all([store.listOpportunities(), store.listCustomers()]);
      setOpps(o);
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

  const custName = (id: string) => customers.find((c) => c.id === id)?.name ?? '—';

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '.75rem' }}>
        {OPP_STAGES.map((st) => {
          const rows = opps.filter((o) => o.stage === st);
          const sum = rows.reduce((s, o) => s + o.value, 0);
          return (
            <div key={st} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '.75rem' }}>
              <div style={{ marginBottom: '.5rem' }}>
                <b style={{ color: C.text, fontSize: '.85rem' }}>{st}</b>
                <div style={{ color: C.muted, fontSize: '.78rem' }}>{rows.length} · {formatVND(sum)}</div>
              </div>
              {rows.map((o) => (
                <div key={o.id} style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 10, padding: '.6rem .7rem', marginBottom: '.5rem' }}>
                  <b style={{ color: '#e2e8f0', fontSize: '.88rem' }}>{o.title}</b>
                  <div style={{ color: '#94a3b8', fontSize: '.78rem' }}>{custName(o.customer_id)}</div>
                  <div style={{ color: '#38bdf8', fontWeight: 700 }}>{formatVND(o.value)} · {o.probability_pct}%</div>
                  <input
                    type="range" min={0} max={100} value={o.probability_pct}
                    onChange={(e) => mutate(() => store!.setProbability(o.id, Number(e.target.value)))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginTop: '.3rem' }}>
                    {st !== 'CLOSED_WON' && <MiniBtn onClick={() => mutate(() => store!.moveOpp(o.id, nextStage(st)))}>→ {nextStage(st)}</MiniBtn>}
                    {!st.startsWith('CLOSED') && <MiniBtn danger onClick={() => mutate(() => store!.moveOpp(o.id, 'CLOSED_LOST'))}>Lost</MiniBtn>}
                  </div>
                </div>
              ))}
              {rows.length === 0 && <div style={{ color: C.muted, fontSize: '.8rem' }}>—</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function nextStage(s: string): import('../types').OppStage {
  const order = ['PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON'] as const;
  const i = order.indexOf(s as (typeof order)[number]);
  return (order[Math.min(i + 1, order.length - 1)] ?? 'CLOSED_WON') as import('../types').OppStage;
}

function MiniBtn(props: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={props.onClick} style={{ background: 'none', border: `1px solid ${props.danger ? '#ef4444' : '#38bdf8'}`, color: props.danger ? '#ef4444' : '#38bdf8', borderRadius: 6, padding: '.2rem .5rem', cursor: 'pointer', fontSize: '.75rem' }}>
      {props.children}
    </button>
  );
}

export function OppPillDemo() { return <Pill text="demo" color="#64748b" />; }
