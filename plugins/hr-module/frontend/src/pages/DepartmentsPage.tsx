// HR Core — Phòng ban: danh sách + headcount + thêm/xóa.
import React, { useCallback, useEffect, useState } from 'react';
import type { Department, Employee } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, TableWrap, Toolbar, td, th } from '../components/ui';

export function DepartmentsPage() {
  const { mode, store, reason, message } = useStore();
  const [depts, setDepts] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [dp, em] = await Promise.all([store.listDepartments(), store.listEmployees()]);
      setDepts(dp);
      setEmployees(em);
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

  const filtered = depts.filter((d) => {
    const q = search.trim().toLowerCase();
    return !q || d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q);
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo mã, tên phòng ban...">
        <Btn primary onClick={() => setShowCreate(true)}>+ Thêm phòng ban</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Mã</th>
            <th style={th}>Tên phòng ban</th>
            <th style={th}>Headcount</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((d) => {
            const headcount = employees.filter((e) => e.department_id === d.id && e.status === 'active').length;
            return (
              <tr key={d.id}>
                <td style={td}><b style={{ color: C.text }}>{d.code}</b></td>
                <td style={td}>{d.name}</td>
                <td style={td}>{headcount} nhân viên</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => {
                      if (confirm(`Xóa phòng ${d.code} — ${d.name}?`)) mutate(() => store!.removeDepartment(d.id));
                    }}
                    style={link}
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có phòng ban phù hợp.</p>}

      {showCreate && (
        <DeptForm
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createDepartment(v);
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
  color: '#ef4444',
  cursor: 'pointer',
  padding: 0,
  fontSize: '.85rem',
};

function DeptForm(props: { onClose: () => void; onSubmit: (v: { code: string; name: string }) => Promise<void> }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  return (
    <Modal title="Thêm phòng ban" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Mã (VD MKT)" value={code} onChange={(e) => setCode(e.target.value)} />
        <Input placeholder="Tên phòng ban" value={name} onChange={(e) => setName(e.target.value)} />
        <Btn
          primary
          disabled={!code.trim() || !name.trim()}
          onClick={() => props.onSubmit({ code: code.trim().toUpperCase(), name: name.trim() })}
        >
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}
