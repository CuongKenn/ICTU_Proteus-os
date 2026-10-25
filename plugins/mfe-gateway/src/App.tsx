// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// MFE Gateway shell — theme-aware (light/dark), đồng bộ với core-engine.
import React, { useCallback, useEffect, useState } from 'react';
import { registry } from './plugins/registry';
import { applyTheme, resolveInitialTheme, toggleTheme, type Theme } from './theme';

// Base path khi host dưới subpath (cùng origin BFF). Vite base = '/plugins-mfe/'.
// Path dạng: /plugins-mfe/<code>[/<sub>]  hoặc /plugins-mfe/.
const BASE = '/plugins-mfe';

function stripBase(pathname: string): string {
  if (pathname === BASE || pathname === `${BASE}/`) return '/';
  if (pathname.startsWith(`${BASE}/`)) return pathname.slice(BASE.length);
  return pathname;
}

function parsePath(): { pluginId: string; subPath: string } {
  const parts = stripBase(window.location.pathname).split('/').filter(Boolean);
  if (parts.length === 0) return { pluginId: '', subPath: '' };
  const [pluginId, ...rest] = parts;
  return { pluginId, subPath: rest.length ? `/${rest.join('/')}` : '' };
}

const panel: React.CSSProperties = {
  background: 'var(--mfe-panel)',
  border: '1px solid var(--mfe-line)',
  borderRadius: 14,
  boxShadow: 'var(--mfe-shadow)',
};

const App = () => {
  const [route, setRoute] = useState(parsePath);
  const [theme, setThemeState] = useState<Theme>(() => resolveInitialTheme());
  const [busy, setBusy] = useState(0);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Global busy indicator: plugin API client phát 'mfe-busy' khi có request.
  useEffect(() => {
    const onBusy = (e: Event) => setBusy(Number((e as CustomEvent).detail) || 0);
    window.addEventListener('mfe-busy', onBusy as EventListener);
    return () => window.removeEventListener('mfe-busy', onBusy as EventListener);
  }, []);

  // Đồng bộ theme khi app chính đổi (storage) hoặc gửi postMessage.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'proteus-theme' && (e.newValue === 'dark' || e.newValue === 'light')) {
        setThemeState(e.newValue);
      }
    };
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; theme?: unknown } | null;
      if (d?.type === 'proteus-theme' && (d.theme === 'dark' || d.theme === 'light')) {
        setThemeState(d.theme);
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  useEffect(() => {
    const onNav = () => setRoute(parsePath());
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  const navigate = useCallback((to: string) => {
    // Giữ base subpath để reload/iframe URL vẫn đúng dưới /plugins-mfe/.
    const target = to.startsWith(BASE) ? to : `${BASE}${to.startsWith('/') ? '' : '/'}${to}`;
    window.history.pushState(null, '', target);
    setRoute(parsePath());
  }, []);

  const navigateSub = useCallback(
    (sub: string) => {
      navigate(`/${route.pluginId}${sub}`);
    },
    [navigate, route.pluginId],
  );

  const onToggleTheme = () => setThemeState((t) => toggleTheme(t));

  const entry = route.pluginId ? registry.find((p) => p.code === route.pluginId) : undefined;

  return (
    <div
      style={{
        background: 'var(--mfe-bg)',
        color: 'var(--mfe-text)',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
      }}
    >
      {/* Global busy progress bar (mọi plugin dùng chung) */}
      <div className="mfe-busy-track">
        {busy > 0 && <div className="mfe-busy-bar" />}
      </div>

      {/* Shell top bar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '.75rem',
          padding: '.6rem 1.25rem',
          background: 'var(--mfe-panel)',
          borderBottom: '1px solid var(--mfe-line)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {route.pluginId ? (
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              border: '1px solid var(--mfe-line)',
              color: 'var(--mfe-muted)',
              borderRadius: 8,
              padding: '.35rem .7rem',
              cursor: 'pointer',
              fontSize: '.8rem',
            }}
          >
            ← Tất cả plugins
          </button>
        ) : (
          <span style={{ fontWeight: 700, fontSize: '.9rem' }}>
            Proteus <span style={{ color: 'var(--mfe-accent)' }}>Plugins</span>
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          className="mfe-theme-toggle"
          onClick={onToggleTheme}
          aria-label="Đổi chế độ sáng/tối"
          title={theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'}
        >
          {theme === 'dark' ? '☀ Sáng' : '🌙 Tối'}
        </button>
      </header>

      {/* / → catalog */}
      {!route.pluginId && <Catalog navigate={navigate} />}

      {route.pluginId && !entry && <NotFound pluginId={route.pluginId} navigate={navigate} />}
      {route.pluginId && entry && !entry.ready && (
        <ComingSoon code={entry.code} name={entry.displayName} desc={entry.description} navigate={navigate} />
      )}
      {route.pluginId && entry && entry.ready && entry.render({ subPath: route.subPath, navigate: navigateSub })}
    </div>
  );
};

function Catalog(props: { navigate: (to: string) => void }) {
  return (
    <div style={{ padding: '2rem 1.25rem' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <h1 style={{ margin: 0, color: 'var(--mfe-text)', letterSpacing: '-0.02em' }}>
          Micro-Frontend Gateway
        </h1>
        <p style={{ color: 'var(--mfe-muted)', marginTop: '.4rem' }}>
          Mỗi plugin có code thật ở <code>plugins/&lt;tên&gt;/frontend/src</code>. Gateway chỉ là host định tuyến.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '1rem',
            marginTop: '1.75rem',
          }}
        >
          {registry.map((p) => (
            <button
              key={p.code}
              onClick={() => p.ready && props.navigate(`/${p.code}`)}
              disabled={!p.ready}
              style={{
                ...panel,
                textAlign: 'left',
                padding: '1.1rem',
                cursor: p.ready ? 'pointer' : 'not-allowed',
                opacity: p.ready ? 1 : 0.6,
                color: 'var(--mfe-text)',
                transition: 'transform .2s, border-color .2s',
              }}
              onMouseEnter={(e) => {
                if (p.ready) e.currentTarget.style.borderColor = 'var(--mfe-accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--mfe-line)';
              }}
            >
              <div style={{ fontWeight: 700 }}>{p.displayName}</div>
              <div style={{ color: 'var(--mfe-muted)', fontSize: '.8rem', margin: '.4rem 0' }}>
                {p.code}
              </div>
              <div
                style={{
                  color: p.ready ? 'var(--mfe-success)' : 'var(--mfe-warning)',
                  fontSize: '.78rem',
                  fontWeight: 700,
                }}
              >
                {p.ready ? 'Sẵn sàng' : 'Đang phát triển'}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComingSoon(props: {
  code: string;
  name: string;
  desc: string;
  navigate: (to: string) => void;
}) {
  return (
    <div style={{ padding: '4rem 1.25rem', display: 'flex', justifyContent: 'center' }}>
      <div style={{ ...panel, padding: '2rem', maxWidth: 560, color: 'var(--mfe-text)' }}>
        <h2 style={{ marginTop: 0 }}>{props.name}</h2>
        <p style={{ color: 'var(--mfe-muted)' }}>{props.desc}</p>
        <p style={{ color: 'var(--mfe-warning)' }}>
          Plugin <code>{props.code}</code> chưa có <code>frontend/src</code>.
        </p>
      </div>
    </div>
  );
}

function NotFound(props: { pluginId: string; navigate: (to: string) => void }) {
  return (
    <div style={{ padding: '4rem 1.25rem', textAlign: 'center', color: 'var(--mfe-text)' }}>
      <h2>Không tìm thấy plugin: {props.pluginId}</h2>
      <button
        onClick={() => props.navigate('/')}
        style={{ color: 'var(--mfe-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        ← Về catalog
      </button>
    </div>
  );
}

export default App;
