// Project Module — Cột mốc: theo dõi tiến độ theo dự án + cập nhật % hoàn thành.
import React, { useCallback, useEffect, useState } from 'react';
import type { Milestone, Project } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, Select, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

export function MilestonesPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<Milestone[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>(ALL);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [m, p] = await Promise.all([store.listMilestones(), store.listProjects()]);
      setRows(m);
      setProjects(p);
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = async (fn: () => Promise<unknown>) => {
    if (!store) return;
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errText(e));
    }
  };

  const projOf = (id: string) => projects.find((p) => p.id === id);
  const filtered = rows.filter((m) => {
    const q = search.trim().toLowerCase();
    const hit = !q || m.name.toLowerCase().includes(q);
    return hit && (projectFilter === ALL || m.project_id === projectFilter);
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo tên cột mốc...">
        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value={ALL}>Mọi dự án</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Thêm cột mốc</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Dự án / Cột mốc</th>
            <th style={th}>Hạn</th>
            <th style={th}>Tiến độ</th>
            <th style={th}>Cập nhật</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((m) => (
            <tr key={m.id}>
              <td style={td}>
                <b style={{ color: C.text }}>{projOf(m.project_id)?.code ?? '—'}</b>
                <div>{m.name}</div>
              </td>
              <td style={td}>{m.due_date || '—'}</td>
              <td style={{ ...td, minWidth: 180 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  <div style={{ flex: 1, height: 8, background: '#0b1220', borderRadius: 999 }}>
                    <div
                      style={{
                        width: `${m.completion_pct}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: m.completion_pct >= 100 ? '#22c55e' : '#38bdf8',
                      }}
                    />
                  </div>
                  <span style={{ color: C.text, fontSize: '.82rem' }}>{m.completion_pct}%</span>
                </div>
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <button onClick={() => mutate(() => store!.updateMilestoneProgress(m.id, m.completion_pct + 25))} style={link}>
                  +25%
                </button>{' '}
                <button onClick={() => mutate(() => store!.updateMilestoneProgress(m.id, 100))} style={link}>
                  Xong
                </button>{' '}
                <button
                  onClick={() => {
                    if (confirm(`Xóa cột mốc "${m.name}"?`)) mutate(() => store!.removeMilestone(m.id));
                  }}
                  style={{ ...link, color: C.red }}
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có cột mốc phù hợp.</p>}
      <p style={{ color: C.muted, fontSize: '.82rem' }}>
        Cập nhật tiến độ = `PATCH project_milestones.completion_pct` (live) — workflow `wf_milestone_reminder` nhắc khi sắp đến hạn.
      </p>

      {showCreate && (
        <CreateForm
          projects={projects}
          defaultProject={projectFilter !== ALL ? projectFilter : undefined}
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createMilestone(v);
              setShowCreate(false);
            })
          }
        />
      )}
    </div>
  );
}

const link: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#38bdf8',
  cursor: 'pointer',
  padding: 0,
  fontSize: '.85rem',
};

function CreateForm(props: {
  projects: Project[];
  defaultProject?: string;
  onClose: () => void;
  onSubmit: (v: { project_id: string; name: string; due_date: string; completion_pct: number }) => Promise<void>;
}) {
  const [project_id, setProject] = useState(props.defaultProject ?? props.projects[0]?.id ?? '');
  const [name, setName] = useState('');
  const [due_date, setDue] = useState('');
  return (
    <Modal title="Thêm cột mốc" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Select value={project_id} onChange={(e) => setProject(e.target.value)}>
          {props.projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </Select>
        <Input placeholder="Tên cột mốc (VD Nghiệm thu đợt 1)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="date" value={due_date} onChange={(e) => setDue(e.target.value)} />
        <Btn primary disabled={!name.trim() || !project_id} onClick={() => props.onSubmit({ project_id, name: name.trim(), due_date, completion_pct: 0 })}>
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}
