// HR Core — Nghỉ phép: tạo đơn (qua workflow) + duyệt/từ chối.
import React, { useCallback, useEffect, useState } from 'react';
import { LEAVE_STATUS_COLOR, LEAVE_STATUS_LABEL, isPendingLeave, leaveDays, type Employee, type LeaveRequest } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, Select, SimpleBadge, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

export function LeavesPage() {
  const { mode, store, reason, message } = useStore();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [lv, em] = await Promise.all([store.listLeaveRequests(), store.listEmployees()]);
      setLeaves(lv);
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

  const nameOf = (id: string) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.employee_code} — ${e.full_name}` : id;
  };

  const filtered = leaves.filter((l) => {
    const q = search.trim().toLowerCase();
    const hit = !q || nameOf(l.employee_id).toLowerCase().includes(q);
    if (!hit) return false;
    if (status === 'PENDING') return isPendingLeave(l.status);
    return status === ALL || l.status === status;
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo tên, mã nhân viên...">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value={ALL}>Mọi trạng thái</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Tạo đơn nghỉ</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Nhân viên</th>
            <th style={th}>Khoảng nghỉ</th>
            <th style={th}>Số ngày</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((l) => (
            <tr key={l.id}>
              <td style={td}>{nameOf(l.employee_id)}</td>
              <td style={td}>
                {l.start_date} → {l.end_date}
                <div style={{ color: C.muted, fontSize: '.78rem' }}>Tạo {String(l.created_at).slice(0, 10)}</div>
              </td>
              <td style={td}>{l.duration_days}</td>
              <td style={td}>
                <SimpleBadge text={LEAVE_STATUS_LABEL[l.status]} color={LEAVE_STATUS_COLOR[l.status]} />
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {isPendingLeave(l.status) ? (
                  <>
                    <button onClick={() => mutate(() => store!.reviewLeaveRequest(l.id, 'APPROVED'))} style={{ ...link, color: C.green }}>
                      Duyệt
                    </button>{' '}
                    <button onClick={() => mutate(() => store!.reviewLeaveRequest(l.id, 'REJECTED'))} style={{ ...link, color: C.red }}>
                      Từ chối
                    </button>
                  </>
                ) : (
                  <span style={{ color: C.muted, fontSize: '.82rem' }}>Đã xử lý</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có đơn nghỉ phù hợp.</p>}
      {mode === 'live' && (
        <p style={{ color: C.muted, fontSize: '.78rem' }}>
          Nút “Tạo đơn nghỉ” gọi workflow n8n `wf_leave_request` qua dispatcher (202 → xử lý ngầm:
          check số dư `hr_leave_balances` rồi nhắn manager).
        </p>
      )}

      {showCreate && (
        <LeaveForm
          employees={employees.map((e) => ({ id: e.id, label: `${e.employee_code} — ${e.full_name} (còn ${e.annual_leave_balance} ngày)` }))}
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createLeaveRequest(v);
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

function LeaveForm(props: {
  employees: Array<{ id: string; label: string }>;
  onClose: () => void;
  onSubmit: (v: { employee_id: string; start_date: string; end_date: string; duration_days: number }) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [employee_id, setEmp] = useState(props.employees[0]?.id ?? '');
  const [start_date, setStart] = useState(today);
  const [end_date, setEnd] = useState(today);
  const days = leaveDays(start_date, end_date);
  return (
    <Modal title="Tạo đơn nghỉ phép" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Select value={employee_id} onChange={(e) => setEmp(e.target.value)}>
          {props.employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </Select>
        <div style={{ display: 'flex', gap: '.6rem' }}>
          <label style={{ flex: 1, color: C.muted, fontSize: '.82rem' }}>
            Từ ngày
            <Input type="date" value={start_date} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label style={{ flex: 1, color: C.muted, fontSize: '.82rem' }}>
            Đến ngày
            <Input type="date" value={end_date} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <div style={{ color: days > 0 ? C.text : C.red, fontSize: '.85rem' }}>
          {days > 0 ? `Tổng: ${days} ngày` : 'Khoảng ngày không hợp lệ (ngày kết thúc phải sau ngày bắt đầu).'}
        </div>
        <Btn
          primary
          disabled={!employee_id || days <= 0}
          onClick={() => props.onSubmit({ employee_id, start_date, end_date, duration_days: days })}
        >
          Gửi đơn
        </Btn>
      </div>
    </Modal>
  );
}
