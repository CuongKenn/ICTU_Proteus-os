import React, { useCallback, useEffect, useState } from 'react';
import { registry } from './plugins/registry';

function parsePath(): { pluginId: string; subPath: string } {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return { pluginId: '', subPath: '' };
  const [pluginId, ...rest] = parts;
  return { pluginId, subPath: rest.length ? `/${rest.join('/')}` : '' };
}

const App = () => {
  const [route, setRoute] = useState(parsePath);

  useEffect(() => {
    const onNav = () => setRoute(parsePath());
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  const navigate = useCallback((to: string) => {
    window.history.pushState(null, '', to);
    setRoute(parsePath());
  }, []);

  const navigateSub = useCallback(
    (sub: string) => {
      navigate(`/${route.pluginId}${sub}`);
    },
    [navigate, route.pluginId],
  );

  // / → catalog
  if (!route.pluginId) return <Catalog navigate={navigate} />;

  const entry = registry.find((p) => p.code === route.pluginId);
  if (!entry) return <NotFound pluginId={route.pluginId} navigate={navigate} />;
  if (!entry.ready) return <ComingSoon code={entry.code} name={entry.displayName} desc={entry.description} navigate={navigate} />;

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1e293b', padding: '.5rem 1.5rem' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.82rem' }}
        >
          ← Tất cả plugins
        </button>
      </div>
      {entry.render({ subPath: route.subPath, navigate: navigateSub })}
    </div>
  );
};

function Catalog(props: { navigate: (to: string) => void }) {
  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: 'white', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1 style={{ color: '#0ea5e9' }}>Micro-Frontend Gateway</h1>
        <p style={{ color: '#94a3b8' }}>
          Mỗi plugin có code thật ở <code>plugins/&lt;tên&gt;/frontend/src</code>. Gateway chỉ là host định tuyến.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          {registry.map((p) => (
            <button
              key={p.code}
              onClick={() => p.ready && props.navigate(`/${p.code}`)}
              disabled={!p.ready}
              style={{
                textAlign: 'left',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 12,
                padding: '1rem',
                cursor: p.ready ? 'pointer' : 'not-allowed',
                opacity: p.ready ? 1 : 0.55,
                color: 'white',
              }}
            >
              <div style={{ fontWeight: 700 }}>{p.displayName}</div>
              <div style={{ color: '#94a3b8', fontSize: '.8rem', margin: '.4rem 0' }}>{p.code}</div>
              <div style={{ color: p.ready ? '#22c55e' : '#f59e0b', fontSize: '.78rem', fontWeight: 700 }}>
                {p.ready ? '● REAL UI' : '○ ĐANG PHÁT TRIỂN'}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComingSoon(props: { code: string; name: string; desc: string; navigate: (to: string) => void }) {
  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '2rem', maxWidth: 560 }}>
        <button onClick={() => props.navigate('/')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>← Tất cả plugins</button>
        <h2>{props.name}</h2>
        <p style={{ color: '#94a3b8' }}>{props.desc}</p>
        <p style={{ color: '#f59e0b' }}>
          Plugin <code>{props.code}</code> chưa có <code>frontend/src</code>. Làm theo mẫu{' '}
          <code>plugins/asset-module/frontend</code> để triển khai.
        </p>
      </div>
    </div>
  );
}

function NotFound(props: { pluginId: string; navigate: (to: string) => void }) {
  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div>
        <h2>Không tìm thấy plugin: {props.pluginId}</h2>
        <button onClick={() => props.navigate('/')} style={{ color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer' }}>
          ← Về catalog
        </button>
      </div>
    </div>
  );
}

export default App;
