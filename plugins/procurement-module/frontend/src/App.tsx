// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
// Procurement Module — root component. Gateway render <ProcurementModuleApp subPath navigate />.
// subPath: phần sau /procurement-module ('' | 'requests' | 'vendors' | 'contracts').
import React from 'react';
import { procurementMeta } from './meta';
import { Dashboard } from './pages/Dashboard';
import { RequestsPage } from './pages/RequestsPage';
import { VendorsPage } from './pages/VendorsPage';
import { ContractsPage } from './pages/ContractsPage';
import { resetStoreCache } from './lib/repo';
import { useStore } from './lib/useStore';

export function ProcurementModuleApp(props: { subPath: string; navigate: (sub: string) => void }) {
  const route = (props.subPath || '').replace(/^\/+|\/+$/g, '');
  const { mode } = useStore();
  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: 'var(--mfe-text)' }}>{procurementMeta.displayName}</h2>
        <p style={{ margin: '.25rem 0 0', color: 'var(--mfe-muted)', fontSize: '.88rem' }}>{procurementMeta.description}</p>
        <nav style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem', flexWrap: 'wrap' }}>
          {procurementMeta.routes.map((r) => {
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
      {route === 'requests' && <RequestsPage />}
      {route === 'vendors' && <VendorsPage />}
      {route === 'contracts' && <ContractsPage />}
      {!['', 'requests', 'vendors', 'contracts'].includes(route) && (
        <p style={{ color: 'var(--mfe-muted)' }}>Trang không tồn tại: /{route}</p>
      )}
    </div>
  );
}

export default ProcurementModuleApp;
