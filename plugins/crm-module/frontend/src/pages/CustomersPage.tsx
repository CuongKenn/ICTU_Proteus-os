// CRM Customers: list + drawer chi tiết (contacts, opps, tickets).
import React, { useEffect, useState } from 'react';
import type { Customer, Opportunity, Ticket } from '../types';
import { formatVND } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import type { Contact } from '../types';
import { C, DataSourceBar, InlineError, td, th } from '../components/ui';

export function CustomersPage() {
  const { mode, store, reason, message } = useStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [c, o, t] = await Promise.all([
          store.listCustomers(),
          store.listOpportunities(),
          store.listTickets(),
        ]);
        let ct: Contact[] = [];
        // Gom contacts theo từng customer (endpoint records chưa hỗ trợ filter).
        for (const cust of c.slice(0, 50)) {
          try {
            const list = await store.listContacts(cust.id);
            ct.push(...list);
          } catch { /* bỏ qua customer lỗi lẻ */ }
        }
        if (!cancelled) {
          setCustomers(c);
          setOpps(o);
          setTickets(t);
          setContacts(ct);
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

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q);
  });
  const sel = filtered.find((c) => c.id === selected) ?? null;

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <div style={{ display: 'grid', gridTemplateColumns: sel ? '1fr 340px' : '1fr', gap: '.75rem' }}>
        <div>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm khách hàng..."
            style={{ width: '100%', background: '#0b1220', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 8, padding: '.55rem .8rem', marginBottom: '1rem', boxSizing: 'border-box' }}
          />
          <div style={{ overflowX: 'auto', border: '1px solid #334155', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e2e8f0', fontSize: '.88rem' }}>
              <thead><tr><th style={th}>Khách hàng</th><th style={th}>Quy mô</th><th style={th}>Liên hệ chính</th></tr></thead>
              <tbody>
                {filtered.map((c) => {
                  const primary = contacts.filter((x) => x.customer_id === c.id).find((x) => x.is_primary);
                  return (
                    <tr key={c.id} onClick={() => setSelected(c.id)} style={{ cursor: 'pointer', background: selected === c.id ? '#1e3a5f' : undefined }}>
                      <td style={td}><b>{c.name}</b><div style={{ color: '#94a3b8' }}>{c.industry} · {c.type}</div></td>
                      <td style={td}>{c.company_size}</td>
                      <td style={td}>{primary ? `${primary.name} (${primary.phone})` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {sel && (
          <aside style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, color: C.text }}>{sel.name}</h4>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>✕</button>
            </div>
            <Section title="Liên hệ">
              {contacts.filter((ct) => ct.customer_id === sel.id).map((ct) => (
                <div key={ct.id} style={{ color: C.text, fontSize: '.85rem', padding: '.3rem 0' }}>
                  {ct.name} — {ct.position}<div style={{ color: C.muted }}>{ct.email} · {ct.phone}</div>
                </div>
              ))}
            </Section>
            <Section title="Cơ hội">
              {opps.filter((o) => o.customer_id === sel.id).map((o) => (
                <div key={o.id} style={{ color: C.text, fontSize: '.85rem', padding: '.3rem 0' }}>
                  {o.title} · <b>{formatVND(o.value)}</b> · {o.stage}
                </div>
              ))}
            </Section>
            <Section title="Tickets">
              {tickets.filter((t) => t.customer_id === sel.id).map((t) => (
                <div key={t.id} style={{ color: C.text, fontSize: '.85rem', padding: '.3rem 0' }}>
                  [{t.priority}] {t.title} — {t.status}
                </div>
              ))}
            </Section>
          </aside>
        )}
      </div>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '.75rem' }}>
      <div style={{ color: '#94a3b8', fontSize: '.78rem', textTransform: 'uppercase', marginBottom: '.25rem' }}>{props.title}</div>
      {props.children}
    </div>
  );
}
