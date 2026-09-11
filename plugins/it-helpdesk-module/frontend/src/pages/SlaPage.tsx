// IT Helpdesk Module — Chính sách SLA: xem + chỉnh số giờ xử lý theo mức ưu tiên.
import React, { useCallback, useEffect, useState } from 'react';
import { PRIORITY_LABEL, type SlaPolicy, type TicketPriority } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, TableWrap, td, th } from '../components/ui';

const ORDER: TicketPriority[] = ['P1', 'P2', 'P3', 'P4'];

export function SlaPage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<SlaPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const ps = await store.listPolicies();
      setRows(ps);
      setHours(Object.fromEntries(ps.map((p) => [p.priority, String(p.resolve_time_hours)])));
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

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  const sorted = [...rows].sort((a, b) => ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority));

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Mức ưu tiên</th>
            <th style={th}>Thời gian xử lý (giờ)</th>
            <th style={th}>Lưu</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.priority}>
              <td style={td}>
                <b style={{ color: C.text }}>{PRIORITY_LABEL[p.priority]}</b>
              </td>
              <td style={td}>
                <Input
                  type="number"
                  min={1}
                  value={hours[p.priority] ?? String(p.resolve_time_hours)}
                  onChange={(e) =>
                    setHours((h) => ({ ...h, [p.priority]: e.target.value }))
                  }
                  style={{ maxWidth: 140 }}
                />
              </td>
              <td style={td}>
                <Btn
                  onClick={() =>
                    mutate(() =>
                      store!.upsertPolicy(p.priority, Number(hours[p.priority]) || p.resolve_time_hours),
                    )
                  }
                >
                  Lưu
                </Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <p style={{ color: C.muted, fontSize: '.82rem' }}>
        Ticket mới tự tính `sla_deadline = created_at + resolve_time_hours`. Quá hạn chưa
        RESOLVED/CLOSED sẽ bị `wf_sla_escalation` gắn cờ escalated (cron 30 phút).
      </p>
    </div>
  );
}
