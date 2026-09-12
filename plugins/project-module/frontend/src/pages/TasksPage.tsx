// Project Tasks kanban: TODO → IN_PROGRESS → REVIEW → DONE.
// Tạo task ở live mode đi qua workflow wf_task_assignment (ghi DB + nhắn người được giao).
import React, { useCallback, useEffect, useState } from 'react';
import { PRIORITY_LABEL, TASK_STAGES, TASK_STATUS_LABEL, type Project, type ProjectTask, type TaskStatus } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, Select, SimpleBadge } from '../components/ui';

export function TasksPage() {
  const { mode, store, reason, message } = useStore();
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [t, p] = await Promise.all([store.listTasks(), store.listProjects()]);
      setTasks(t);
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

  const visible = projectFilter === 'ALL' ? tasks : tasks.filter((t) => t.project_id === projectFilter);
  const projCode = (id: string) => projects.find((p) => p.id === id)?.code ?? '—';

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  const nextOf: Record<TaskStatus, TaskStatus | null> = {
    TODO: 'IN_PROGRESS',
    IN_PROGRESS: 'REVIEW',
    REVIEW: 'DONE',
    DONE: null,
  };
  const nextLabel: Record<TaskStatus, string> = {
    TODO: 'Bắt đầu',
    IN_PROGRESS: 'Gửi duyệt',
    REVIEW: 'Hoàn thành',
    DONE: '',
  };

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="ALL">Mọi dự án</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Thêm công việc</Btn>
      </div>
      {mode === 'live' && (
        <p style={{ color: C.muted, fontSize: '.78rem' }}>
          “Thêm công việc” gọi workflow `wf_task_assignment` (ghi DB + nhắn người được giao).
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '.75rem' }}>
        {TASK_STAGES.map((st) => {
          const rows = visible.filter((t) => t.status === st);
          return (
            <div key={st} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem' }}>
                <b style={{ color: C.text }}>{TASK_STATUS_LABEL[st]}</b>
                <SimpleBadge text={String(rows.length)} color={C.muted} />
              </div>
              {rows.map((t) => (
                <TaskCard
                  key={t.id}
                  title={t.title}
                  sub={`${projCode(t.project_id)} · ${t.assignee_name || 'chưa giao'} · hạn ${t.due_date || '—'}`}
                  priority={`${PRIORITY_LABEL[t.priority]}${t.description ? ` — ${t.description}` : ''}`}
                  actions={
                    <>
                      {nextOf[st] && (
                        <MiniBtn onClick={() => mutate(() => store!.moveTask(t.id, nextOf[st]!))}>
                          {nextLabel[st]} →
                        </MiniBtn>
                      )}
                      <MiniBtn
                        danger
                        onClick={() => {
                          if (confirm(`Xóa task "${t.title}"?`)) mutate(() => store!.removeTask(t.id));
                        }}
                      >
                        Xóa
                      </MiniBtn>
                    </>
                  }
                />
              ))}
              {rows.length === 0 && <div style={{ color: C.muted, fontSize: '.8rem' }}>—</div>}
            </div>
          );
        })}
      </div>
      {showCreate && (
        <CreateTask
          projects={projects}
          defaultProject={projectFilter !== 'ALL' ? projectFilter : undefined}
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createTask(v);
              setShowCreate(false);
            })
          }
        />
      )}
    </div>
  );
}

function TaskCard(props: { title: string; sub: string; priority: string; actions: React.ReactNode }) {
  return (
    <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 10, padding: '.6rem .7rem', marginBottom: '.5rem' }}>
      <b style={{ color: '#e2e8f0', fontSize: '.88rem' }}>{props.title}</b>
      <div style={{ color: '#94a3b8', fontSize: '.78rem' }}>{props.sub}</div>
      <div style={{ color: '#38bdf8', fontWeight: 700, margin: '.25rem 0', fontSize: '.8rem' }}>{props.priority}</div>
      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>{props.actions}</div>
    </div>
  );
}

function MiniBtn(props: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      style={{
        background: 'none', border: `1px solid ${props.danger ? '#ef4444' : '#38bdf8'}`,
        color: props.danger ? '#ef4444' : '#38bdf8', borderRadius: 6,
        padding: '.2rem .5rem', cursor: 'pointer', fontSize: '.75rem',
      }}
    >
      {props.children}
    </button>
  );
}

function CreateTask(props: {
  projects: Project[];
  defaultProject?: string;
  onClose: () => void;
  onSubmit: (v: {
    project_id: string;
    milestone_id: string | null;
    title: string;
    description: string;
    assignee_id: string | null;
    assignee_name: string;
    due_date: string;
    priority: ProjectTask['priority'];
    status: TaskStatus;
  }) => Promise<void>;
}) {
  const [project_id, setProject] = useState(props.defaultProject ?? props.projects[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDesc] = useState('');
  const [assignee_name, setAssignee] = useState('');
  const [due_date, setDue] = useState('');
  const [priority, setPriority] = useState<ProjectTask['priority']>('MEDIUM');
  return (
    <Modal title="Thêm công việc" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Select value={project_id} onChange={(e) => setProject(e.target.value)}>
          {props.projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </Select>
        <Input placeholder="Tiêu đề task" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Mô tả" value={description} onChange={(e) => setDesc(e.target.value)} />
        <Input placeholder="Người thực hiện (VD Nguyễn Văn An)" value={assignee_name} onChange={(e) => setAssignee(e.target.value)} />
        <Input type="date" value={due_date} onChange={(e) => setDue(e.target.value)} />
        <Select value={priority} onChange={(e) => setPriority(e.target.value as ProjectTask['priority'])}>
          <option value="LOW">Thấp</option>
          <option value="MEDIUM">Trung bình</option>
          <option value="HIGH">Cao</option>
          <option value="URGENT">Khẩn cấp</option>
        </Select>
        <Btn
          primary
          disabled={!title.trim() || !project_id}
          onClick={() =>
            props.onSubmit({
              project_id,
              milestone_id: null,
              title: title.trim(),
              description,
              assignee_id: null,
              assignee_name: assignee_name.trim(),
              due_date,
              priority,
              status: 'TODO',
            })
          }
        >
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}
