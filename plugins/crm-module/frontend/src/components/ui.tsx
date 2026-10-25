// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
// CRM primitives (dark theme, khớp asset-module).
import React from 'react';

export const C = {
  panel: 'var(--mfe-panel)',
  line: 'var(--mfe-line)',
  text: 'var(--mfe-text)',
  muted: 'var(--mfe-muted)',
  accent: 'var(--mfe-accent)',
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
        background: primary ? 'var(--mfe-primary)' : 'transparent',
        color: primary ? 'var(--mfe-on-accent)' : C.text, cursor: 'pointer', fontWeight: 600,
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
        width: '100%', background: 'var(--mfe-panel-2)', border: `1px solid ${C.line}`,
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
        background: 'var(--mfe-panel-2)', border: `1px solid ${C.line}`, color: C.text,
        borderRadius: 8, padding: '.55rem .8rem',
        ...((props as { style?: React.CSSProperties }).style ?? {}),
      }}
    />
  );
}

export function Modal(props: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={props.onClose} style={{ position: 'fixed', inset: 0, background: 'var(--mfe-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
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

export const th: React.CSSProperties = { textAlign: 'left', padding: '.7rem .9rem', color: 'var(--mfe-muted)', borderBottom: '1px solid var(--mfe-line)', background: 'var(--mfe-panel-2)', whiteSpace: 'nowrap' };
export const td: React.CSSProperties = { padding: '.7rem .9rem', borderBottom: '1px solid var(--mfe-line-soft)', verticalAlign: 'top' };

export function DataSourceBar(props: {
  mode: 'live' | 'demo' | null;
  reasonText: string | null;
  message?: string;
}) {
  // LIVE dùng dữ liệu thật từ API — không hiện banner nữa.
  if (props.mode !== 'demo') return null;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '.4rem',
        background: 'var(--mfe-warning-soft)',
        border: '1px solid var(--mfe-warning)',
        color: 'var(--mfe-warning)',
        borderRadius: 999,
        padding: '.25rem .7rem',
        fontSize: '.75rem',
        fontWeight: 600,
        marginBottom: '1rem',
      }}
    >
      Dữ liệu mẫu{props.reasonText ? ' · ' + props.reasonText : ''}
{props.message ? ' (' + props.message + ')' : ''}
    </div>
  );
}

export function InlineError(props: { text: string | null; onClose?: () => void }) {
  if (!props.text) return null;
  return (
    <div
      style={{
        background: 'var(--mfe-danger-soft)',
        border: '1px solid var(--mfe-danger)',
        color: 'var(--mfe-danger)',
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
          style={{ background: 'none', border: 'none', color: 'var(--mfe-danger)', cursor: 'pointer', marginLeft: '.5rem' }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
