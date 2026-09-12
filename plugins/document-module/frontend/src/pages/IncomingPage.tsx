// Document Module — Văn bản đến: search/filter + tiếp nhận + điều chuyển.
// Tạo mới LIVE đi qua dispatcher wf_incoming_document; điều chuyển qua
// wf_reassign_document; còn lại CRUD records.
import React, { useCallback, useEffect, useState } from 'react';
import { INCOMING_LABEL, type IncomingDoc, type IncomingStatus } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Badge, Btn, C, DataSourceBar, InlineError, Input, Modal, Select, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

const colorOf = (s: IncomingStatus) =>
  s === 'done' ? C.green : s === 'processing' ? C.accent : C.amber;

export function IncomingPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<IncomingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [showCreate, setShowCreate] = useState(false);
  const [reassigning, setReassigning] = useState<IncomingDoc | null>(null);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await store.listIncoming());
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

  const filtered = rows.filter((d) => {
    const q = search.trim().toLowerCase();
    const hit =
      !q ||
      d.so_van_ban.toLowerCase().includes(q) ||
      d.noi_gui.toLowerCase().includes(q) ||
      d.trich_yeu.toLowerCase().includes(q);
    return hit && (status === ALL || d.status === status);
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo số VB, nơi gửi, trích yếu...">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value={ALL}>Mọi trạng thái</option>
          <option value="received">Mới tiếp nhận</option>
          <option value="processing">Đang xử lý</option>
          <option value="done">Hoàn tất</option>
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Tiếp nhận văn bản</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Số VB / Nơi gửi</th>
            <th style={th}>Trích yếu</th>
            <th style={th}>Người xử lý</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((d) => (
            <tr key={d.id}>
              <td style={td}>
                <b style={{ color: C.text }}>{d.so_van_ban}</b>
                <div>{d.noi_gui}</div>
                <div style={{ color: C.muted, fontSize: '.78rem' }}>Nhận {d.ngay_nhan}</div>
              </td>
              <td style={td}>{d.trich_yeu}</td>
              <td style={td}>{d.assignee_id ?? '—'}</td>
              <td style={td}><Badge text={INCOMING_LABEL[d.status]} color={colorOf(d.status)} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <button onClick={() => setReassigning(d)} style={link}>Điều chuyển</button>{' '}
                {d.status !== 'done' && (
                  <button
                    onClick={() =>
                      mutate(() =>
                        store!.updateIncoming(d.id, {
                          status: d.status === 'received' ? 'processing' : 'done',
                        }),
                      )
                    }
                    style={link}
                  >
                    {d.status === 'received' ? 'Xử lý' : 'Hoàn tất'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có văn bản phù hợp.</p>}
      {mode === 'live' && (
        <p style={{ color: C.muted, fontSize: '.78rem' }}>
          Nút “Tiếp nhận” gọi workflow n8n `wf_incoming_document`, “Điều chuyển” gọi
          `wf_reassign_document` qua dispatcher (202 → xử lý ngầm).
        </p>
      )}

      {showCreate && (
        <IncomingForm
          title="Tiếp nhận văn bản đến"
          onClose={() => setShowCreate(false)}
          onSubmit={(v) => mutate(async () => { await store!.createIncoming(v); setShowCreate(false); })}
        />
      )}
      {reassigning && (
        <ReassignForm
          soVb={reassigning.so_van_ban}
          onClose={() => setReassigning(null)}
          onSubmit={(a) =>
            mutate(async () => {
              await store!.reassignIncoming(reassigning.id, a);
              setReassigning(null);
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

function IncomingForm(props: {
  title: string;
  onClose: () => void;
  onSubmit: (v: Omit<IncomingDoc, 'id' | 'status'>) => Promise<void>;
}) {
  const [so_van_ban, setSo] = useState('');
  const [noi_gui, setNoiGui] = useState('');
  const [ngay_nhan, setNgay] = useState(new Date().toISOString().slice(0, 10));
  const [trich_yeu, setTrich] = useState('');
  const [assignee_id, setAssignee] = useState('');
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Số văn bản (VD 1234/BGDĐT-VP)" value={so_van_ban} onChange={(e) => setSo(e.target.value)} />
        <Input placeholder="Nơi gửi (VD UBND tỉnh Thái Nguyên)" value={noi_gui} onChange={(e) => setNoiGui(e.target.value)} />
        <Input type="date" value={ngay_nhan} onChange={(e) => setNgay(e.target.value)} />
        <Input placeholder="Trích yếu nội dung" value={trich_yeu} onChange={(e) => setTrich(e.target.value)} />
        <Input placeholder="Người xử lý / Phòng ban (để trống nếu chưa phân)" value={assignee_id} onChange={(e) => setAssignee(e.target.value)} />
        <Btn
          primary
          disabled={!so_van_ban.trim() || !noi_gui.trim()}
          onClick={() =>
            props.onSubmit({
              so_van_ban: so_van_ban.trim(),
              noi_gui: noi_gui.trim(),
              ngay_nhan,
              trich_yeu: trich_yeu.trim() || '(chưa có trích yếu)',
              file_url: '',
              assignee_id: assignee_id.trim() || null,
            })
          }
        >
          Tiếp nhận
        </Btn>
      </div>
    </Modal>
  );
}

function ReassignForm(props: { soVb: string; onClose: () => void; onSubmit: (a: string) => Promise<void> }) {
  const [assignee, setAssignee] = useState('');
  return (
    <Modal title={`Điều chuyển ${props.soVb}`} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Người nhận / Phòng ban mới" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
        <Btn primary disabled={!assignee.trim()} onClick={() => props.onSubmit(assignee.trim())}>
          Xác nhận điều chuyển
        </Btn>
      </div>
    </Modal>
  );
}
