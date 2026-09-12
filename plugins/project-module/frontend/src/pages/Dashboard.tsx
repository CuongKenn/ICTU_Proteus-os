// Project Module — Tổng quan: KPI dự án/task + tiến độ + task sắp hạn.
import React, { useEffect, useState } from 'react';
import { PROJECT_STATUS_LABEL, formatVND, type Milestone, type Project, type ProjectTask } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { C, DataSourceBar, InlineError, StatCard, TableWrap, td, th } from '../components/ui';

export function Dashboard() {
  const { mode, store, reason, message } = useStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [p, t, m] = await Promise.all([
          store.listProjects(),
          store.listTasks(),
          store.listMilestones(),
        ]);
        if (!cancelled) {
          setProjects(p);
          setTasks(t);
          setMilestones(m);
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

  const active = projects.filter((p) => p.status === 'ACTIVE').length;
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter((t) => t.status !== 'DONE' && t.due_date && t.due_date < today);
  const totalBudget = projects
    .filter((p) => p.status !== 'CANCELLED')
    .reduce((s, p) => s + p.budget, 0);
  const byStatus = projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const maxCount = Math.max(1, ...Object.values(byStatus));
  const upcomingMilestones = [...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5);
  const projName = (id: string) => projects.find((p) => p.id === id)?.code ?? '—';

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <StatCard label="Tổng dự án" value={String(projects.length)} sub={`${active} đang triển khai`} />
        <StatCard label="Tổng ngân sách" value={formatVND(totalBudget)} sub="chưa hủy" />
        <StatCard label="Công việc hoàn thành" value={`${doneTasks}/${tasks.length}`} />
        <StatCard label="Task quá hạn" value={String(overdue.length)} sub="chưa DONE mà trễ hạn" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '.75rem' }}>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
          <h4 style={{ margin: '0 0 .75rem 0', color: C.text }}>Phân bổ trạng thái dự án</h4>
          {(Object.keys(PROJECT_STATUS_LABEL) as Array<keyof typeof PROJECT_STATUS_LABEL>).map((st) => (
            <div key={st} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.5rem' }}>
              <span style={{ width: 130, color: C.muted, fontSize: '.82rem' }}>{PROJECT_STATUS_LABEL[st]}</span>
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
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
          <h4 style={{ margin: '0 0 .75rem 0', color: C.text }}>Cột mốc sắp tới</h4>
          <TableWrap>
            <thead>
              <tr>
                <th style={th}>Dự án</th>
                <th style={th}>Cột mốc</th>
                <th style={th}>Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {upcomingMilestones.map((m) => (
                <tr key={m.id}>
                  <td style={td}>{projName(m.project_id)}</td>
                  <td style={td}>
                    {m.name}
                    <div style={{ color: C.muted, fontSize: '.78rem' }}>Hạn: {m.due_date}</div>
                  </td>
                  <td style={td}>{m.completion_pct}%</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <div style={{ color: C.muted, fontSize: '.78rem', marginTop: '.5rem' }}>
            Nguồn: `project_milestones.due_date` + workflow `wf_milestone_reminder`.
          </div>
        </div>
      </div>
    </div>
  );
}
