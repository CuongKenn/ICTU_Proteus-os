import React, { useState, useEffect } from 'react';

const App = () => {
  const [pluginId, setPluginId] = useState<string>('unknown');

  useEffect(() => {
    // Extract plugin name from URL path (e.g. /crm-module -> crm-module)
    // Routing: plugins.proteus.local/{plugin-code-name}
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      setPluginId(pathParts[0]);
    }
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', backgroundColor: '#0f172a', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '800px', width: '100%' }}>
        <h1 style={{ color: '#0ea5e9', fontSize: '2.5rem', marginBottom: '1rem', textAlign: 'center' }}>
          Micro-Frontend Gateway
        </h1>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '2rem' }}>
          Rendered by a single React Vite instance.
        </p>
        
        <div style={{ padding: '2rem', backgroundColor: '#1e293b', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
            <div style={{ width: '48px', height: '48px', backgroundColor: '#3b82f6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.25rem' }}>
              {pluginId.substring(0, 2).toUpperCase()}
            </div>
            <h2 style={{ margin: 0, fontSize: '1.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {pluginId} MODULE
            </h2>
          </div>
          
          <p style={{ color: '#cbd5e1', lineHeight: '1.6', marginBottom: '2rem' }}>
            Bạn đang xem giao diện Micro-Frontend tùy chỉnh (Custom UI) của Plugin <strong>{pluginId}</strong>. Giao diện này được code hoàn toàn bằng React và chạy độc lập với App Shell chính của Proteus OS.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
               <h3 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8', fontSize: '1rem' }}>Thống kê</h3>
               <p style={{ margin: 0, color: '#94a3b8' }}>Dữ liệu demo</p>
            </div>
            <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
               <h3 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8', fontSize: '1rem' }}>Hành động</h3>
               <button style={{ padding: '0.5rem 1rem', background: '#3b82f6', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', width: '100%' }}>
                 Gửi Request
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
