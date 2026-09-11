// CRM Leads kanban: NEW → CONTACTED → QUALIFIED → CONVERTED / LOST.
// Nút "Convert" ở live mode ghi OPP thật vào DB.
import React, { useCallback, useEffect, useState } from 'react';
import type { Lead } from '../types';
import { LEAD_STAGES, formatVND, type LeadStage } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, Pill } from '../components/ui';

export function LeadsPage() {
  const { mode, store, reason, message } = useStore();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      setLeads(await store.listLeads());
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

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <div style={{ marginBottom: '1rem' }}>
        <Btn primary onClick={() => setShowCreate(true)}>+ Thêm lead</Btn>
      </div>
      {mode === 'live' && (
        <p style={{ color: C.muted, fontSize: '.78rem' }}>
          “Thêm lead” gọi workflow `wf_lead_capture` (ghi DB + nhắn kênh sales).
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '.75rem' }}>
        {LEAD_STAGES.map((st) => {
          const rows = leads.filter((l) => l.stage === st);
          return (
            <div key={st} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem' }}>
                <b style={{ color: C.text }}>{st}</b>
                <Pill text={String(rows.length)} color={C.muted} />
              </div>
              {rows.map((l) => (
                <LeadCard
                  key={l.id}
                  title={l.contact_name}
                  sub={`${l.company_name} · ${l.source}`}
                  value={formatVND(l.estimated_value)}
                  actions={
                    <>
                      {st === 'NEW' && <MiniBtn onClick={() => mutate(() => store!.moveLead(l.id, 'CONTACTED'))}>Liên hệ</MiniBtn>}
                      {st === 'CONTACTED' && <MiniBtn onClick={() => mutate(() => store!.moveLead(l.id, 'QUALIFIED'))}>Đạt chuẩn</MiniBtn>}
                      {st === 'QUALIFIED' && (
                        <MiniBtn onClick={() => mutate(() => store!.convertLead(l.id))}>Convert → Opp</MiniBtn>
                      )}
                      {!['CONVERTED', 'LOST'].includes(st) && (
                        <MiniBtn danger onClick={() => mutate(() => store!.moveLead(l.id, 'LOST'))}>Lost</MiniBtn>
                      )}
                    </>
                  }
                />
              ))}
              {rows.length === 0 && <div style={{ color: C.muted, fontSize: '.8rem' }}>—</div>}
            </div>
          );
        })}
      </div>
      {showCreate && (
        <CreateLead
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createLead(v);
              setShowCreate(false);
            })
          }
        />
      )}
    </div>
  );
}

function LeadCard(props: { title: string; sub: string; value: string; actions: React.ReactNode }) {
  return (
    <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 10, padding: '.6rem .7rem', marginBottom: '.5rem' }}>
      <b style={{ color: '#e2e8f0', fontSize: '.88rem' }}>{props.title}</b>
      <div style={{ color: '#94a3b8', fontSize: '.78rem' }}>{props.sub}</div>
      <div style={{ color: '#38bdf8', fontWeight: 700, margin: '.25rem 0' }}>{props.value}</div>
      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>{props.actions}</div>
    </div>
  );
}

function MiniBtn(props: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      style={{
        background: 'none', border: `1px solid ${props.danger ? '#ef4444' : '#38bdf8'}`,
        color: props.danger ? '#ef4444' : '#38bdf8', borderRadius: 6,
        padding: '.2rem .5rem', cursor: 'pointer', fontSize: '.75rem',
      }}
    >
      {props.children}
    </button>
  );
}

function CreateLead(props: { onClose: () => void; onSubmit: (v: { contact_name: string; company_name: string; email: string; phone: string; source: string; estimated_value: number }) => Promise<void> }) {
  const [contact_name, setName] = useState('');
  const [company_name, setCo] = useState('');
  const [email, setEmail] = useState('');
  const [val, setVal] = useState('0');
  return (
    <Modal title="Thêm lead" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Tên liên hệ" value={contact_name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Công ty" value={company_name} onChange={(e) => setCo(e.target.value)} />
        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Giá trị ước tính" value={val} onChange={(e) => setVal(e.target.value)} />
        <Btn primary onClick={() => props.onSubmit({ contact_name, company_name, email, phone: '', source: 'WEBSITE', estimated_value: Number(val) || 0 })}>
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}

export type { LeadStage };
