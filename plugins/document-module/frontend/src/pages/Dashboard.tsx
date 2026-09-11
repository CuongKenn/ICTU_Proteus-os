// Document Module — Tổng quan: KPI + văn bản chờ xử lý + phê duyệt tồn.
import React, { useEffect, useState } from 'react';
import { INCOMING_LABEL, type ApprovalItem, type IncomingDoc, type OutgoingDoc } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { C, DataSourceBar, InlineError, StatCard, TableWrap, td, th } from '../components/ui';

export function Dashboard() {
  const { mode, store, reason, message } = useStore();
  const [incoming, setIncoming] = useState<IncomingDoc[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingDoc[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [inc, out, app] = await Promise.all([
          store.listIncoming(),
          store.listOutgoing(),
          store.listApprovals(),
        ]);
        if (!cancelled) {
          setIncoming(inc);
          setOutgoing(out);
          setApprovals(app);
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

  const pendingApproval = approvals.filter((a) => a.status === 'pending').length;
  const byStatus = incoming.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});
  const waiting = [...incoming]
    .filter((d) => d.status !== 'done')
    .sort((a, b) => b.ngay_nhan.localeCompare(a.ngay_nhan))
    .slice(0, 5);
  const maxCount = Math.max(1, ...Object.values(byStatus));

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <StatCard label="Văn bản đến" value={String(incoming.length)} sub={`${byStatus['received'] ?? 0} mới tiếp nhận`} />
        <StatCard label="Văn bản đi" value={String(outgoing.length)} sub={`${outgoing.filter((o) => o.status === 'draft').length} bản nháp`} />
        <StatCard label="Chờ phê duyệt" value={String(pendingApproval)} sub="luồng ký pending" />
        <StatCard label="Đã hoàn tất" value={String(byStatus['done'] ?? 0)} sub="văn bản đến done" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '.75rem' }}>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
          <h4 style={{ margin: '0 0 .75rem 0', color: C.text }}>Văn bản đến theo trạng thái</h4>
          {(Object.keys(INCOMING_LABEL) as Array<keyof typeof INCOMING_LABEL>).map((st) => (
            <div key={st} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.5rem' }}>
              <span style={{ width: 110, color: C.muted, fontSize: '.82rem' }}>{INCOMING_LABEL[st]}</span>
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
            Nguồn: `document_incoming.status` + workflow `wf_incoming_document`.
          </div>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
          <h4 style={{ margin: '0 0 .75rem 0', color: C.text }}>Văn bản đến cần xử lý</h4>
          <TableWrap>
            <thead>
              <tr>
                <th style={th}>Số văn bản</th>
                <th style={th}>Ngày nhận</th>
                <th style={th}>Người xử lý</th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((d) => (
                <tr key={d.id}>
                  <td style={td}>{d.so_van_ban}</td>
                  <td style={td}>{d.ngay_nhan}</td>
                  <td style={td}>{d.assignee_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <div style={{ color: C.muted, fontSize: '.78rem', marginTop: '.5rem' }}>
            Điều chuyển qua workflow `wf_reassign_document`, ký duyệt qua `wf_document_approval`.
          </div>
        </div>
      </div>
    </div>
  );
}
