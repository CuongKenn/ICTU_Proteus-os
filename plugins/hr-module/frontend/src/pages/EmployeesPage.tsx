// HR Core — Nhân viên: search/filter + CRUD hồ sơ.
import React, { useCallback, useEffect, useState } from 'react';
import type { Department, Employee, EmployeeStatus } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Badge, Btn, C, DataSourceBar, InlineError, Input, Modal, Select, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

export function EmployeesPage() {
  const { mode, store, reason, message } = useStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [em, dp] = await Promise.all([store.listEmployees(), store.listDepartments()]);
      setEmployees(em);
      setDepts(dp);
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

  const deptName = (id: string) => depts.find((d) => d.id === id)?.name ?? '—';

  const filtered = employees.filter((e) => {
    const q = search.trim().toLowerCase();
    const hit =
      !q ||
      e.employee_code.toLowerCase().includes(q) ||
      e.full_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q);
    return hit && (dept === ALL || e.department_id === dept) && (status === ALL || e.status === status);
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo mã, tên, email...">
        <Select value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value={ALL}>Mọi phòng ban</option>
          {depts.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value={ALL}>Mọi trạng thái</option>
          <option value="active">Đang làm việc</option>
          <option value="inactive">Nghỉ việc</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Thêm nhân viên</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Mã / Họ tên</th>
            <th style={th}>Phòng ban · Chức vụ</th>
            <th style={th}>Phép còn lại</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((e) => (
            <tr key={e.id}>
              <td style={td}>
                <b style={{ color: C.text }}>{e.employee_code}</b>
                <div>{e.full_name}</div>
                <div style={{ color: C.muted, fontSize: '.78rem' }}>{e.email} · Vào làm {e.hire_date}</div>
              </td>
              <td style={td}>
                {deptName(e.department_id)}
                <div style={{ color: C.muted, fontSize: '.78rem' }}>{e.position || '—'}</div>
              </td>
              <td style={td}>{e.annual_leave_balance} ngày</td>
              <td style={td}><Badge status={e.status} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <button onClick={() => setEditing(e)} style={link}>Sửa</button>{' '}
                <button
                  onClick={() => {
                    if (confirm(`Xóa ${e.employee_code} — ${e.full_name}?`)) mutate(() => store!.removeEmployee(e.id));
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
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có nhân viên phù hợp.</p>}

      {showCreate && (
        <EmployeeForm
          title="Thêm nhân viên"
          departments={depts}
          onClose={() => setShowCreate(false)}
          onSubmit={(v) => mutate(async () => { await store!.createEmployee(v); setShowCreate(false); })}
        />
      )}
      {editing && (
        <EmployeeForm
          title={`Sửa ${editing.employee_code}`}
          initial={editing}
          departments={depts}
          onClose={() => setEditing(null)}
          onSubmit={(v) => mutate(async () => { await store!.updateEmployee(editing.id, v); setEditing(null); })}
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

function EmployeeForm(props: {
  title: string;
  initial?: Employee;
  departments: Department[];
  onClose: () => void;
  onSubmit: (v: Omit<Employee, 'id'>) => Promise<void>;
}) {
  const [employee_code, setCode] = useState(props.initial?.employee_code ?? '');
  const [full_name, setName] = useState(props.initial?.full_name ?? '');
  const [email, setEmail] = useState(props.initial?.email ?? '');
  const [department_id, setDept] = useState(
    props.initial?.department_id ?? props.departments[0]?.id ?? '',
  );
  const [position, setPosition] = useState(props.initial?.position ?? '');
  const [hire_date, setHireDate] = useState(
    props.initial?.hire_date ?? new Date().toISOString().slice(0, 10),
  );
  const [status, setStatus] = useState<EmployeeStatus>(props.initial?.status ?? 'active');
  const [balance, setBalance] = useState(String(props.initial?.annual_leave_balance ?? 12));
  const [emergency_contact, setEmergency] = useState(props.initial?.emergency_contact ?? '');

  return (
    <Modal title={props.title} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Mã NV (VD NV010)" value={employee_code} onChange={(e) => setCode(e.target.value)} />
        <Input placeholder="Họ tên" value={full_name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Select value={department_id} onChange={(e) => setDept(e.target.value)}>
          {props.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Input placeholder="Chức vụ" value={position} onChange={(e) => setPosition(e.target.value)} />
        <Input type="date" value={hire_date} onChange={(e) => setHireDate(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value as EmployeeStatus)}>
          <option value="active">Đang làm việc</option>
          <option value="inactive">Nghỉ việc</option>
        </Select>
        <Input placeholder="Số ngày phép/năm" value={balance} onChange={(e) => setBalance(e.target.value)} />
        <Input placeholder="Liên hệ khẩn cấp" value={emergency_contact} onChange={(e) => setEmergency(e.target.value)} />
        <Btn
          primary
          onClick={() =>
            props.onSubmit({
              employee_code: employee_code.trim() || `NV${String(Date.now()).slice(-4)}`,
              full_name: full_name.trim() || 'Nhân viên mới',
              email: email.trim(),
              department_id,
              position,
              hire_date,
              status,
              annual_leave_balance: Number(balance) || 0,
              emergency_contact: emergency_contact || undefined,
            })
          }
        >
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}
