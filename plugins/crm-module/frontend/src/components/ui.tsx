// CRM primitives (dark theme, khớp asset-module).
import React from 'react';

export const C = {
  panel: '#1e293b',
  line: '#334155',
  text: '#e2e8f0',
  muted: '#94a3b8',
  accent: '#38bdf8',
};

export function StatCard(props: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem 1.25rem', minWidth: 150, flex: 1 }}>
      <div style={{ color: C.muted, fontSize: '.8rem' }}>{props.label}</div>
      <div style={{ color: C.text, fontSize: '1.4rem', fontWeight: 700 }}>{props.value}</div>
      {props.sub && <div style={{ color: C.muted, fontSize: '.78rem' }}>{props.sub}</div>}
    </div>
  );
}

export function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  const { primary, style, ...rest } = props;
  return (
    <button
      {...rest}
      style={{
        padding: '.5rem .9rem', borderRadius: 8,
        border: primary ? 'none' : `1px solid ${C.line}`,
        background: primary ? '#2563eb' : 'transparent',
        color: primary ? '#fff' : C.text, cursor: 'pointer', fontWeight: 600,
        ...(style ?? {}),
      }}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%', background: '#0b1220', border: `1px solid ${C.line}`,
        color: C.text, borderRadius: 8, padding: '.55rem .8rem', boxSizing: 'border-box',
        ...((props as { style?: React.CSSProperties }).style ?? {}),
      }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        background: '#0b1220', border: `1px solid ${C.line}`, color: C.text,
        borderRadius: 8, padding: '.55rem .8rem',
        ...((props as { style?: React.CSSProperties }).style ?? {}),
      }}
    />
  );
}

export function Modal(props: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={props.onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 520, color: C.text }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>{props.title}</h3>
          <button onClick={props.onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>✕</button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

export function Pill(props: { text: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: '.75rem', fontWeight: 700, color: props.color, border: `1px solid ${props.color}`, whiteSpace: 'nowrap' }}>
      {props.text}
    </span>
  );
}

export const th: React.CSSProperties = { textAlign: 'left', padding: '.7rem .9rem', color: '#94a3b8', borderBottom: '1px solid #334155', background: '#0b1220', whiteSpace: 'nowrap' };
export const td: React.CSSProperties = { padding: '.7rem .9rem', borderBottom: '1px solid #1e293b', verticalAlign: 'top' };

export function DataSourceBar(props: {
  mode: 'live' | 'demo' | null;
  reasonText: string | null;
  message?: string;
}) {
  if (!props.mode) return null;
  const live = props.mode === 'live';
  return (
    <div
      style={{
        background: live ? 'rgba(34,197,94,.08)' : 'rgba(245,158,11,.08)',
        border: `1px solid ${live ? '#22c55e' : '#f59e0b'}`,
        color: live ? '#22c55e' : '#f59e0b',
        borderRadius: 8,
        padding: '.45rem .8rem',
        fontSize: '.8rem',
        marginBottom: '1rem',
      }}
    >
      {live ? (
        <>● LIVE — dữ liệu thật từ API (Postgres + n8n).</>
      ) : (
        <>○ DEMO — dữ liệu local. {props.reasonText} {props.message ? `(${props.message})` : ''}</>
      )}
    </div>
  );
}

export function InlineError(props: { text: string | null; onClose?: () => void }) {
  if (!props.text) return null;
  return (
    <div
      style={{
        background: 'rgba(239,68,68,.1)',
        border: '1px solid #ef4444',
        color: '#fca5a5',
        borderRadius: 8,
        padding: '.5rem .8rem',
        fontSize: '.82rem',
        marginBottom: '1rem',
      }}
    >
      {props.text}
      {props.onClose && (
        <button
          onClick={props.onClose}
          style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', marginLeft: '.5rem' }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
