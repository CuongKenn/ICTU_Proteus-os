// Asset Module — Dashboard: KPI + phân bổ trạng thái + bảo trì sắp tới.
import React, { useEffect, useState } from 'react';
import { STATUS_LABEL, formatVND, type AssetItem } from '../types';
import type { DisposalRequest, MaintenanceLog } from '../types';
import { useStore, errText } from '../lib/useStore';
import { C, DataSourceBar, InlineError, StatCard, td, th, TableWrap } from '../components/ui';
import { reasonText } from '../lib/useStore';

export function Dashboard() {
  const { mode, store, reason, message } = useStore();
  const [items, setItems] = useState<AssetItem[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceLog[]>([]);
  const [disposals, setDisposals] = useState<DisposalRequest[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [it, mt, dp, ct] = await Promise.all([
          store.listItems(),
          store.listMaintenance(),
          store.listDisposals(),
          store.listCategories(),
        ]);
        if (!cancelled) {
          setItems(it);
          setMaintenance(mt);
          setDisposals(dp);
          setCats(ct);
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

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  const totalValue = items
    .filter((i) => i.status !== 'DISPOSED')
    .reduce((s, i) => s + i.book_value_remaining, 0);
  const byStatus = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});
  const upcoming = [...maintenance]
    .sort((a, b) => a.next_due.localeCompare(b.next_due))
    .slice(0, 5);
  const pendingDisposals = disposals.filter((d) => d.status === 'PENDING').length;

  const maxCount = Math.max(1, ...Object.values(byStatus));

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <StatCard label="Tổng tài sản" value={String(items.length)} sub={`${items.filter((i) => i.status === 'AVAILABLE').length} sẵn sàng`} />
        <StatCard label="Giá trị còn lại" value={formatVND(totalValue)} sub="chưa thanh lý" />
        <StatCard label="Đang cấp phát" value={String(byStatus['ASSIGNED'] ?? 0)} />
        <StatCard label="Chờ thanh lý" value={String(pendingDisposals)} sub="đề xuất PENDING" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '.75rem' }}>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
          <h4 style={{ margin: '0 0 .75rem 0', color: C.text }}>Phân bổ trạng thái</h4>
          {(Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>).map((st) => (
            <div key={st} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.5rem' }}>
              <span style={{ width: 110, color: C.muted, fontSize: '.82rem' }}>{STATUS_LABEL[st]}</span>
              <div style={{ flex: 1, height: 8, background: '#0b1220', borderRadius: 999 }}>
                <div
                  style={{
                    width: `${(((byStatus[st] ?? 0) / maxCount) * 100).toFixed(0)}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: '#38bdf8',
                  }}
                />
              </div>
              <span style={{ width: 28, textAlign: 'right', color: C.text }}>{byStatus[st] ?? 0}</span>
            </div>
          ))}
          <div style={{ color: C.muted, fontSize: '.78rem', marginTop: '.5rem' }}>
            Khấu hao đường thẳng theo `calculate_depreciation_batch` (migrations).
          </div>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
          <h4 style={{ margin: '0 0 .75rem 0', color: C.text }}>Bảo trì sắp tới</h4>
          <TableWrap>
            <thead>
              <tr>
                <th style={th}>Mã</th>
                <th style={th}>Hạn</th>
                <th style={th}>Loại</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((m) => {
                const item = items.find((i) => i.id === m.asset_id);
                return (
                  <tr key={m.id}>
                    <td style={td}>{item?.code ?? '—'}</td>
                    <td style={td}>{m.next_due}</td>
                    <td style={td}>{m.type}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
          <div style={{ color: C.muted, fontSize: '.78rem', marginTop: '.5rem' }}>
            Nguồn: `asset_maintenance_logs.next_due` + workflow `wf_maintenance_schedule`.
          </div>
        </div>
      </div>

      <div style={{ marginTop: '.75rem', color: C.muted, fontSize: '.82rem' }}>
        Danh mục: {cats.map((c) => `${c.code} (${c.name})`).join(' · ')}
      </div>
    </div>
  );
}
