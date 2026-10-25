// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
// Finance Module — root component. Gateway render <FinanceModuleApp subPath navigate />.
// subPath: phần sau /finance-module ('' | 'transactions' | 'invoices' | 'expenses').
import React from 'react';
import { financeMeta } from './meta';
import { Dashboard } from './pages/Dashboard';
import { TransactionsPage } from './pages/TransactionsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { resetStoreCache } from './lib/repo';
import { useStore } from './lib/useStore';

export function FinanceModuleApp(props: { subPath: string; navigate: (sub: string) => void }) {
  const route = (props.subPath || '').replace(/^\/+|\/+$/g, '');
  const { mode } = useStore();
  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: 'var(--mfe-text)' }}>{financeMeta.displayName}</h2>
        <p style={{ margin: '.25rem 0 0', color: 'var(--mfe-muted)', fontSize: '.88rem' }}>{financeMeta.description}</p>
        <nav style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem', flexWrap: 'wrap' }}>
          {financeMeta.routes.map((r) => {
            const active = route === r.path;
            return (
              <button
                key={r.path}
                onClick={() => props.navigate(r.path ? `/${r.path}` : '')}
                style={{
                  padding: '.45rem .9rem',
                  borderRadius: 8,
                  border: active ? 'none' : '1px solid var(--mfe-line)',
                  background: active ? 'var(--mfe-primary)' : 'transparent',
                  color: active ? 'var(--mfe-on-accent)' : 'var(--mfe-text)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {r.label}
              </button>
            );
          })}
          <span style={{ flex: 1 }} />
          {/* Chỉ hiện ở DEMO (xóa localStorage demo). LIVE không cần. */}
          {mode !== 'live' && (
            <button
              onClick={() => {
                resetStoreCache();
                window.location.reload();
              }}
              title="Xóa localStorage demo, dò lại API"
              style={{ background: 'none', border: 'none', color: 'var(--mfe-dim)', cursor: 'pointer', fontSize: '.8rem' }}
            >
              Reset demo
            </button>
          )}
        </nav>
      </header>
      {route === '' && <Dashboard />}
      {route === 'transactions' && <TransactionsPage />}
      {route === 'invoices' && <InvoicesPage />}
      {route === 'expenses' && <ExpensesPage />}
      {!['', 'transactions', 'invoices', 'expenses'].includes(route) && (
        <p style={{ color: 'var(--mfe-muted)' }}>Trang không tồn tại: /{route}</p>
      )}
    </div>
  );
}

export default FinanceModuleApp;
