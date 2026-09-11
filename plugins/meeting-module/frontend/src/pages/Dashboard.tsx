// Meeting Module — Tổng quan: KPI + lịch sắp tới + việc quá hạn.
import React, { useEffect, useState } from 'react';
import { fmtTime, type ActionItem, type Booking, type MeetingRoom } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { C, DataSourceBar, InlineError, StatCard, TableWrap, td, th } from '../components/ui';

export function Dashboard() {
  const { mode, store, reason, message } = useStore();
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [rm, bk, ac] = await Promise.all([
          store.listRooms(),
          store.listBookings(),
          store.listActions(),
        ]);
        if (!cancelled) {
          setRooms(rm);
          setBookings(bk);
          setActions(ac);
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

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = [...bookings]
    .filter((b) => b.status === 'SCHEDULED')
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(0, 5);
  const overdue = actions.filter(
    (a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && a.due_date && a.due_date < today,
  );
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? '—';

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <StatCard label="Phòng họp" value={String(rooms.filter((r) => r.is_active).length)} sub={`${rooms.length} tổng số`} />
        <StatCard label="Lịch đã đặt" value={String(bookings.filter((b) => b.status === 'SCHEDULED').length)} sub="chưa diễn ra" />
        <StatCard label="Việc cần làm" value={String(actions.filter((a) => a.status === 'PENDING' || a.status === 'IN_PROGRESS').length)} sub="đang mở" />
        <StatCard label="Quá hạn" value={String(overdue.length)} sub="action items trễ" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '.75rem' }}>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
          <h4 style={{ margin: '0 0 .75rem 0', color: C.text }}>Lịch họp sắp tới</h4>
          <TableWrap>
            <thead>
              <tr>
                <th style={th}>Cuộc họp</th>
                <th style={th}>Phòng</th>
                <th style={th}>Bắt đầu</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((b) => (
                <tr key={b.id}>
                  <td style={td}>{b.title}</td>
                  <td style={td}>{roomName(b.room_id)}</td>
                  <td style={td}>{fmtTime(b.start_time)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          {upcoming.length === 0 && <p style={{ color: C.muted }}>Chưa có lịch sắp tới.</p>}
          <div style={{ color: C.muted, fontSize: '.78rem', marginTop: '.5rem' }}>
            Nguồn: `meeting_bookings` + workflow `wf_meeting_booking` / `wf_meeting_reminder`.
          </div>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
          <h4 style={{ margin: '0 0 .75rem 0', color: C.text }}>Việc quá hạn</h4>
          <TableWrap>
            <thead>
              <tr>
                <th style={th}>Việc</th>
                <th style={th}>Người phụ trách</th>
                <th style={th}>Hạn</th>
              </tr>
            </thead>
            <tbody>
              {overdue.slice(0, 5).map((a) => (
                <tr key={a.id}>
                  <td style={td}>{a.task_desc}</td>
                  <td style={td}>{a.owner_id}</td>
                  <td style={{ ...td, color: C.red }}>{a.due_date}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          {overdue.length === 0 && <p style={{ color: C.muted }}>Không có việc quá hạn. 🎉</p>}
          <div style={{ color: C.muted, fontSize: '.78rem', marginTop: '.5rem' }}>
            Nhắc việc qua workflow `wf_action_item_followup`.
          </div>
        </div>
      </div>
    </div>
  );
}
