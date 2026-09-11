// Project Module — Dự án: search/filter + CRUD + đổi trạng thái.
import React, { useCallback, useEffect, useState } from 'react';
import { formatVND, type Project, type ProjectStatus } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Badge, Btn, C, DataSourceBar, InlineError, Input, Modal, Select, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

export function ProjectsPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [editing, setEditing] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await store.listProjects());
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

  const filtered = rows.filter((p) => {
    const q = search.trim().toLowerCase();
    const hit =
      !q ||
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.manager_name.toLowerCase().includes(q);
    return hit && (status === ALL || p.status === status);
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo mã, tên, quản lý...">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value={ALL}>Mọi trạng thái</option>
          <option value="PLANNING">Chuẩn bị</option>
          <option value="ACTIVE">Đang triển khai</option>
          <option value="ON_HOLD">Tạm dừng</option>
          <option value="COMPLETED">Hoàn thành</option>
          <option value="CANCELLED">Đã hủy</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Thêm dự án</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Mã / Tên</th>
            <th style={th}>Quản lý / Thời gian</th>
            <th style={th}>Ngân sách</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id}>
              <td style={td}>
                <b style={{ color: C.text }}>{p.code}</b>
                <div>{p.name}</div>
              </td>
              <td style={td}>
                {p.manager_name || '—'}
                <div style={{ color: C.muted, fontSize: '.78rem' }}>{p.start_date} → {p.end_date}</div>
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatVND(p.budget)}</td>
              <td style={td}><Badge status={p.status} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <button onClick={() => setEditing(p)} style={link}>Sửa</button>{' '}
                {p.status === 'PLANNING' && (
                  <button onClick={() => mutate(() => store!.setProjectStatus(p.id, 'ACTIVE'))} style={link}>
                    Khởi động
                  </button>
                )}{' '}
                {p.status === 'ACTIVE' && (
                  <button onClick={() => mutate(() => store!.setProjectStatus(p.id, 'COMPLETED'))} style={link}>
                    Hoàn thành
                  </button>
                )}{' '}
                <button
                  onClick={() => {
                    if (confirm(`Xóa ${p.code}? (xóa cả milestone + task liên quan)`)) {
                      mutate(() => store!.removeProject(p.id));
                    }
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
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có dự án phù hợp.</p>}

      {showCreate && (
        <ProjectForm
          title="Thêm dự án"
          onClose={() => setShowCreate(false)}
          onSubmit={(v) => mutate(async () => { await store!.createProject(v); setShowCreate(false); })}
        />
      )}
      {editing && (
        <ProjectForm
          title={`Sửa ${editing.code}`}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(v) => mutate(async () => { await store!.updateProject(editing.id, v); setEditing(null); })}
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

function ProjectForm(props: {
  title: string;
  initial?: Project;
  onClose: () => void;
  onSubmit: (v: Omit<Project, 'id'>) => Promise<void>;
}) {
  const [code, setCode] = useState(props.initial?.code ?? '');
  const [name, setName] = useState(props.initial?.name ?? '');
  const [manager_name, setManager] = useState(props.initial?.manager_name ?? '');
  const [start_date, setStart] = useState(props.initial?.start_date ?? new Date().toISOString().slice(0, 10));
  const [end_date, setEnd] = useState(props.initial?.end_date ?? '');
  const [budget, setBudget] = useState(String(props.initial?.budget ?? 0));
  const [status, setStatus] = useState<ProjectStatus>(props.initial?.status ?? 'PLANNING');
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Mã (VD PRJ-006)" value={code} onChange={(e) => setCode(e.target.value)} />
        <Input placeholder="Tên dự án" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Quản lý (VD Trần Thị Bình)" value={manager_name} onChange={(e) => setManager(e.target.value)} />
        <label style={{ color: C.muted, fontSize: '.8rem' }}>
          Bắt đầu
          <Input type="date" value={start_date} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label style={{ color: C.muted, fontSize: '.8rem' }}>
          Kết thúc
          <Input type="date" value={end_date} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <Input placeholder="Ngân sách (VND)" value={budget} onChange={(e) => setBudget(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
          <option value="PLANNING">Chuẩn bị</option>
          <option value="ACTIVE">Đang triển khai</option>
          <option value="ON_HOLD">Tạm dừng</option>
          <option value="COMPLETED">Hoàn thành</option>
          <option value="CANCELLED">Đã hủy</option>
        </Select>
        <Btn
          primary
          onClick={() =>
            props.onSubmit({
              code: code.trim() || `PRJ-${Date.now() % 10000}`,
              name: name.trim() || 'Dự án mới',
              manager_id: props.initial?.manager_id ?? null,
              manager_name: manager_name.trim(),
              start_date,
              end_date,
              budget: Number(budget) || 0,
              status,
            })
          }
        >
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}
