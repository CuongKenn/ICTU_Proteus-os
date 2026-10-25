// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// HR — Tuyển dụng (ATS): bảng tin tuyển dụng + pipeline ứng viên + phỏng vấn/offer.
// P2: tạo hồ sơ/phỏng vấn qua dispatcher (wf_application_received,
// wf_interview_schedule). P3: "AI chấm" gọi DSL hr.applications.screen.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Application,
  AppStage,
  Department,
  Interview,
  JobPosting,
  Offer,
} from '../types';
import { APP_STAGES, formatVND } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import {
  Btn,
  C,
  DataSourceBar,
  InlineError,
  Input,
  Modal,
  Select,
  StatCard,
} from '../components/ui';

// ─── Meta ─────────────────────────────────────────────────────

const EMPLOYMENT_TYPES = [
  { value: 'FULLTIME', label: 'Toàn thời gian' },
  { value: 'PARTTIME', label: 'Bán thời gian' },
  { value: 'CONTRACT', label: 'Hợp đồng' },
  { value: 'INTERN', label: 'Thực tập' },
];

const POSTING_STATUS: Record<
  JobPosting['status'],
  { label: string; color: string; soft: string }
> = {
  OPEN: { label: 'Đang mở', color: 'var(--mfe-success)', soft: 'var(--mfe-success-soft)' },
  CLOSED: { label: 'Đã đóng', color: 'var(--mfe-dim)', soft: 'var(--mfe-panel-2)' },
  DRAFT: { label: 'Nháp', color: 'var(--mfe-warning)', soft: 'var(--mfe-warning-soft)' },
};

const STAGE_META: Record<
  AppStage,
  { label: string; color: string; soft: string }
> = {
  NEW: { label: 'Hồ sơ mới', color: 'var(--mfe-accent)', soft: 'var(--mfe-accent-soft)' },
  SCREENING: { label: 'Sàng lọc', color: 'var(--mfe-violet)', soft: 'var(--mfe-violet-soft)' },
  INTERVIEW: { label: 'Phỏng vấn', color: 'var(--mfe-warning)', soft: 'var(--mfe-warning-soft)' },
  OFFER: { label: 'Offer', color: 'var(--mfe-accent)', soft: 'var(--mfe-accent-soft)' },
  HIRED: { label: 'Nhận việc', color: 'var(--mfe-success)', soft: 'var(--mfe-success-soft)' },
  REJECTED: { label: 'Từ chối', color: 'var(--mfe-danger)', soft: 'var(--mfe-danger-soft)' },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--mfe-success)';
  if (score >= 60) return 'var(--mfe-warning)';
  return 'var(--mfe-danger)';
}

// ─── Page ─────────────────────────────────────────────────────

export function RecruitmentPage() {
  const { mode, store, reason, message } = useStore();

  const [apps, setApps] = useState<Application[]>([]);
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [postingFilter, setPostingFilter] = useState<string>('all');

  const [showPosting, setShowPosting] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [schedulingFor, setSchedulingFor] = useState<Application | null>(null);
  const [offeringFor, setOfferingFor] = useState<Application | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [screenMsg, setScreenMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [a, p, i, o, d] = await Promise.all([
        store.listApplications(),
        store.listPostings(),
        store.listInterviews(),
        store.listOffers(),
        store.listDepartments(),
      ]);
      setApps(a);
      setPostings(p);
      setInterviews(i);
      setOffers(o);
      setDepts(d);
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

  const postingName = useCallback(
    (id: string) => postings.find((p) => p.id === id)?.title ?? '—',
    [postings],
  );

  const deptName = useCallback(
    (id: string) => depts.find((d) => d.id === id)?.name ?? '',
    [depts],
  );

  const stageCounts = useMemo(() => {
    const counts = {} as Record<AppStage, number>;
    APP_STAGES.forEach((s) => (counts[s] = 0));
    apps.forEach((a) => (counts[a.stage] = (counts[a.stage] ?? 0) + 1));
    return counts;
  }, [apps]);

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (postingFilter !== 'all' && a.posting_id !== postingFilter) return false;
      if (!q) return true;
      return (
        a.full_name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q)
      );
    });
  }, [apps, search, postingFilter]);

  // AI chấm chạy nền ở n8n (~1 phút). Sau khi trigger, poll danh sách hồ sơ
  // để cập nhật điểm mà không cần reload trang.
  const pollForScore = useCallback(
    async (id: string) => {
      if (!store) return;
      for (let i = 0; i < 45; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        try {
          const list = await store.listApplications();
          setApps(list);
          const found = list.find((a) => a.id === id);
          if (found && found.score !== null) return;
        } catch {
          /* lỗi tạm thời — thử lại */
        }
      }
    },
    [store],
  );

  const runScreen = (a: Application) => {
    if (!store) return;
    setError(null);
    setBusyId(a.id);
    setScreenMsg(`AI đang chấm hồ sơ ${a.full_name} (LLM local ~1 phút)...`);
    void (async () => {
      try {
        await store.screenApplication(a.id);
      } catch (e) {
        const msg = errText(e);
        // Timeout/abort do LLM chậm → workflow vẫn chạy nền, không báo lỗi cứng.
        if (!/502|504|timeout|abort|mạng|network|fetch/i.test(msg)) {
          setError(msg);
        }
      }
      await pollForScore(a.id);
      setBusyId(null);
      setScreenMsg(null);
    })();
  };

  if (!store || loading) {
    return <p style={{ color: C.muted, padding: '1rem 0' }}>Đang tải dữ liệu tuyển dụng...</p>;
  }

  const total = apps.length;
  const hired = stageCounts.HIRED ?? 0;
  const hireRate = total ? Math.round((hired / total) * 100) : 0;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      {screenMsg && (
        <div
          style={{
            background: 'var(--mfe-accent-soft)',
            border: '1px solid var(--mfe-accent)',
            color: 'var(--mfe-accent)',
            borderRadius: 8,
            padding: '.5rem .8rem',
            fontSize: '.82rem',
            marginBottom: '1rem',
          }}
        >
          {screenMsg}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '.75rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: C.text, fontSize: '1.15rem' }}>Tuyển dụng</h3>
          <p style={{ margin: '.3rem 0 0', color: C.muted, fontSize: '.85rem', maxWidth: 620 }}>
            Quản lý tin tuyển dụng, hồ sơ ứng viên và luồng sàng lọc → phỏng vấn →
            offer → nhận việc.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <Btn onClick={() => setShowPosting(true)}>+ Tin tuyển dụng</Btn>
          <Btn primary disabled={postings.length === 0} onClick={() => setShowApp(true)}>
            + Hồ sơ ứng viên
          </Btn>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <StatCard label="Tổng hồ sơ" value={String(total)} sub={`${postings.length} tin tuyển dụng`} />
        <StatCard label="Chờ sàng lọc" value={String(stageCounts.NEW ?? 0)} sub="hồ sơ mới" />
        <StatCard label="Đang phỏng vấn" value={String(stageCounts.INTERVIEW ?? 0)} sub={`${stageCounts.SCREENING ?? 0} đang sàng lọc`} />
        <StatCard label="Offer" value={String(stageCounts.OFFER ?? 0)} sub="chờ phản hồi" />
        <StatCard label="Đã nhận việc" value={String(hired)} sub={`Tỉ lệ ${hireRate}%`} />
      </div>

      {/* Job postings */}
      <SectionTitle title="Tin tuyển dụng" count={postings.length} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '.75rem',
          marginBottom: '1.25rem',
        }}
      >
        {postings.map((p) => {
          const status = POSTING_STATUS[p.status] ?? POSTING_STATUS.OPEN;
          const applicants = apps.filter((a) => a.posting_id === p.id);
          const active = postingFilter === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPostingFilter(active ? 'all' : p.id)}
              style={{
                textAlign: 'left',
                background: C.panel,
                border: `1px solid ${active ? 'var(--mfe-accent)' : C.line}`,
                borderRadius: 14,
                padding: '.9rem 1rem',
                cursor: 'pointer',
                color: C.text,
                boxShadow: active ? 'var(--mfe-shadow-lg)' : 'var(--mfe-shadow)',
                transition: 'border-color .2s, box-shadow .2s, transform .2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
                <b style={{ fontSize: '.95rem' }}>{p.title}</b>
                <span
                  style={{
                    color: status.color,
                    background: status.soft,
                    border: `1px solid ${status.color}`,
                    borderRadius: 999,
                    padding: '1px 8px',
                    fontSize: '.7rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    height: 'fit-content',
                  }}
                >
                  {status.label}
                </span>
              </div>
              <div style={{ color: C.muted, fontSize: '.8rem', marginTop: '.35rem' }}>
                {deptName(p.department_id) || 'Chưa gán phòng ban'} ·{' '}
                {EMPLOYMENT_TYPES.find((t) => t.value === p.employment_type)?.label ??
                  p.employment_type}
              </div>
              <div style={{ color: C.muted, fontSize: '.8rem' }}>
                {p.location || '—'} · {formatVND(p.salary_min)} – {formatVND(p.salary_max)}
              </div>
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.55rem' }}>
                <MiniStat label="Hồ sơ" value={applicants.length} />
                <MiniStat
                  label="Nhận việc"
                  value={applicants.filter((a) => a.stage === 'HIRED').length}
                  color="var(--mfe-success)"
                />
              </div>
            </button>
          );
        })}
        {postings.length === 0 && (
          <div
            style={{
              border: `1px dashed ${C.line}`,
              borderRadius: 14,
              padding: '1.25rem',
              color: C.muted,
              fontSize: '.85rem',
            }}
          >
            Chưa có tin tuyển dụng. Bấm “+ Tin tuyển dụng” để bắt đầu.
          </div>
        )}
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: '.6rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '.75rem',
        }}
      >
        <Input
          placeholder="Tìm theo tên, email, SĐT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <Select
          value={postingFilter}
          onChange={(e) => setPostingFilter(e.target.value)}
          aria-label="Lọc theo tin tuyển dụng"
        >
          <option value="all">Tất cả tin tuyển dụng</option>
          {postings.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </Select>
        {(search || postingFilter !== 'all') && (
          <Btn
            onClick={() => {
              setSearch('');
              setPostingFilter('all');
            }}
          >
            Xóa lọc
          </Btn>
        )}
      </div>

      {/* Pipeline board */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '.75rem',
        }}
      >
        {APP_STAGES.map((st) => {
          const meta = STAGE_META[st];
          const rows = filteredApps.filter((a) => a.stage === st);
          return (
            <div
              key={st}
              style={{
                background: C.panel,
                border: `1px solid ${C.line}`,
                borderTop: `3px solid ${meta.color}`,
                borderRadius: 14,
                padding: '.75rem',
                boxShadow: 'var(--mfe-shadow)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '.6rem',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: meta.color,
                      display: 'inline-block',
                    }}
                  />
                  <b style={{ color: C.text, fontSize: '.88rem' }}>{meta.label}</b>
                </span>
                <span
                  style={{
                    background: meta.soft,
                    color: meta.color,
                    borderRadius: 999,
                    padding: '1px 9px',
                    fontSize: '.72rem',
                    fontWeight: 700,
                  }}
                >
                  {rows.length}
                </span>
              </div>

              {rows.map((a) => {
                const iv = interviews.filter((x) => x.application_id === a.id);
                const offer = offers.find((o) => o.application_id === a.id);
                const busy = busyId === a.id;
                return (
                  <AppCard
                    key={a.id}
                    app={a}
                    posting={postingName(a.posting_id)}
                    iv={iv}
                    offer={offer}
                    busy={busy}
                    onScreen={() => runScreen(a)}
                    onMove={(target) => mutate(() => store!.moveApplication(a.id, target))}
                    onSchedule={() => setSchedulingFor(a)}
                    onOffer={() => setOfferingFor(a)}
                    onHire={(offerId) => mutate(() => store!.hireFromOffer(offerId))}
                  />
                );
              })}
              {rows.length === 0 && (
                <div style={{ color: C.muted, fontSize: '.8rem', padding: '.25rem 0' }}>
                  Chưa có hồ sơ
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showPosting && (
        <PostingForm
          departments={depts.map((d) => ({ id: d.id, name: d.name }))}
          onClose={() => setShowPosting(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createPosting(v);
              setShowPosting(false);
            })
          }
        />
      )}
      {showApp && (
        <ApplicationForm
          postings={postings.map((p) => ({ id: p.id, title: p.title }))}
          onClose={() => setShowApp(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createApplication(v);
              setShowApp(false);
            })
          }
        />
      )}
      {schedulingFor && (
        <InterviewForm
          name={schedulingFor.full_name}
          onClose={() => setSchedulingFor(null)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.scheduleInterview({ ...v, application_id: schedulingFor.id });
              await store!.moveApplication(schedulingFor.id, 'INTERVIEW');
              setSchedulingFor(null);
            })
          }
        />
      )}
      {offeringFor && (
        <OfferForm
          name={offeringFor.full_name}
          onClose={() => setOfferingFor(null)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createOffer({ ...v, application_id: offeringFor.id });
              await store!.moveApplication(offeringFor.id, 'OFFER');
              setOfferingFor(null);
            })
          }
        />
      )}
    </div>
  );
}

// ─── Candidate card ───────────────────────────────────────────

function AppCard(props: {
  app: Application;
  posting: string;
  iv: Interview[];
  offer?: Offer;
  busy: boolean;
  onScreen: () => void;
  onMove: (stage: AppStage) => void;
  onSchedule: () => void;
  onOffer: () => void;
  onHire: (offerId: string) => void;
}) {
  const { app, posting, iv, offer, busy } = props;
  const stage = app.stage;
  const done = stage === 'HIRED' || stage === 'REJECTED';

  return (
    <div
      style={{
        background: 'var(--mfe-panel-2)',
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: '.7rem',
        marginBottom: '.55rem',
      }}
    >
      <div style={{ display: 'flex', gap: '.55rem', alignItems: 'center' }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: STAGE_META[stage].soft,
            color: STAGE_META[stage].color,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '.8rem',
            flexShrink: 0,
          }}
        >
          {initials(app.full_name)}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              color: C.text,
              fontWeight: 600,
              fontSize: '.88rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {app.full_name}
          </div>
          <div style={{ color: C.muted, fontSize: '.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {posting}
          </div>
        </div>
        {app.score !== null && (
          <span
            title={`Điểm AI: ${app.score}/100`}
            style={{
              color: scoreColor(app.score),
              border: `1px solid ${scoreColor(app.score)}`,
              borderRadius: 999,
              padding: '1px 8px',
              fontSize: '.72rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            AI {app.score}
          </span>
        )}
      </div>

      <div style={{ color: C.muted, fontSize: '.75rem', marginTop: '.45rem', display: 'grid', gap: '2px' }}>
        {app.email && <span style={{ overflowWrap: 'anywhere' }}>{app.email}</span>}
        {app.phone && <span>{app.phone}</span>}
        {app.source && <span>Nguồn: {app.source}</span>}
      </div>

      {iv.length > 0 && (
        <div style={{ color: 'var(--mfe-warning)', fontSize: '.75rem', marginTop: '.4rem' }}>
          {iv.map((x) => `${String(x.scheduled_at).slice(0, 16).replace('T', ' ')} · ${x.result}`).join(' | ')}
        </div>
      )}

      {offer && (
        <div style={{ color: 'var(--mfe-success)', fontSize: '.75rem', marginTop: '.4rem' }}>
          Offer {formatVND(offer.salary_offered)} · bắt đầu {offer.start_date || '—'} · {offer.status}
        </div>
      )}

      {app.screening_notes && (
        <div style={{ color: C.muted, fontSize: '.73rem', marginTop: '.35rem', fontStyle: 'italic' }}>
          {app.screening_notes}
        </div>
      )}

      {!done && (
        <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginTop: '.55rem' }}>
          {stage === 'NEW' && (
            <ActionBtn onClick={() => props.onMove('SCREENING')}>Sàng lọc</ActionBtn>
          )}
          {stage === 'SCREENING' && (
            <ActionBtn onClick={props.onSchedule}>Hẹn phỏng vấn</ActionBtn>
          )}
          {stage === 'INTERVIEW' && (
            <ActionBtn onClick={props.onOffer}>Tạo offer</ActionBtn>
          )}
          {stage === 'OFFER' && !offer && (
            <ActionBtn onClick={props.onOffer}>Tạo offer</ActionBtn>
          )}
          {stage === 'OFFER' && offer && offer.status !== 'ACCEPTED' && (
            <ActionBtn variant="success" onClick={() => props.onHire(offer.id)}>
              Nhận việc
            </ActionBtn>
          )}
          {app.score === null && !['OFFER'].includes(stage) && (
            <ActionBtn variant="muted" onClick={props.onScreen}>
              {busy ? 'Đang chấm...' : 'AI chấm'}
            </ActionBtn>
          )}
          <ActionBtn variant="danger" onClick={() => props.onMove('REJECTED')}>
            Loại
          </ActionBtn>
        </div>
      )}
    </div>
  );
}

function ActionBtn(props: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'success' | 'danger' | 'muted';
}) {
  const color =
    props.variant === 'danger'
      ? 'var(--mfe-danger)'
      : props.variant === 'success'
        ? 'var(--mfe-success)'
        : props.variant === 'muted'
          ? 'var(--mfe-muted)'
          : 'var(--mfe-accent)';
  return (
    <button
      onClick={props.onClick}
      style={{
        background: 'transparent',
        border: `1px solid ${color}`,
        color,
        borderRadius: 8,
        padding: '.22rem .55rem',
        cursor: 'pointer',
        fontSize: '.74rem',
        fontWeight: 600,
      }}
    >
      {props.children}
    </button>
  );
}

function MiniStat(props: { label: string; value: number; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '.3rem' }}>
      <b style={{ color: props.color ?? C.text, fontSize: '.85rem' }}>{props.value}</b>
      <span style={{ color: C.muted, fontSize: '.72rem' }}>{props.label}</span>
    </span>
  );
}

function SectionTitle(props: { title: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.6rem' }}>
      <span
        style={{
          width: 3,
          height: 16,
          borderRadius: 2,
          background: 'var(--mfe-accent)',
          display: 'inline-block',
        }}
      />
      <h4 style={{ margin: 0, color: C.text, fontSize: '.95rem' }}>{props.title}</h4>
      {props.count !== undefined && (
        <span style={{ color: C.muted, fontSize: '.8rem' }}>({props.count})</span>
      )}
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '.3rem' }}>
      <span style={{ color: C.muted, fontSize: '.78rem', fontWeight: 600 }}>{props.label}</span>
      {props.children}
    </label>
  );
}

// ─── Forms ────────────────────────────────────────────────────

function PostingForm(props: {
  departments: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (v: Omit<JobPosting, 'id'>) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [deptId, setDeptId] = useState('');
  const [employmentType, setEmploymentType] = useState('FULLTIME');
  const [location, setLocation] = useState('');
  const [min, setMin] = useState('15000000');
  const [max, setMax] = useState('25000000');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = title.trim().length > 0 && Number(max) >= Number(min) && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await props.onSubmit({
        title: title.trim(),
        employment_type: employmentType,
        location: location.trim(),
        salary_min: Number(min) || 0,
        salary_max: Number(max) || 0,
        description: description.trim(),
        requirements: '',
        status: 'OPEN',
        // Chỉ gửi department_id khi có — tránh gửi '' làm backend lỗi UUID.
        ...(deptId ? { department_id: deptId } : {}),
      } as Omit<JobPosting, 'id'>);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Tin tuyển dụng mới" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.7rem' }}>
        <Field label="Vị trí *">
          <Input
            placeholder="VD: Backend Developer (Python)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
          <Field label="Phòng ban">
            <Select value={deptId} onChange={(e) => setDeptId(e.target.value)} style={{ width: '100%' }}>
              <option value="">Chưa gán</option>
              {props.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hình thức">
            <Select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              style={{ width: '100%' }}
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Địa điểm">
          <Input
            placeholder="VD: Thái Nguyên / Remote"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
          <Field label="Lương tối thiểu (VND)">
            <Input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
          </Field>
          <Field label="Lương tối đa (VND)">
            <Input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} />
          </Field>
        </div>
        {Number(max) < Number(min) && (
          <div style={{ color: 'var(--mfe-danger)', fontSize: '.78rem' }}>
            Lương tối đa phải lớn hơn hoặc bằng tối thiểu.
          </div>
        )}
        <Field label="Mô tả công việc">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Mô tả ngắn về vị trí..."
            style={{
              width: '100%',
              background: 'var(--mfe-panel-2)',
              border: `1px solid ${C.line}`,
              color: C.text,
              borderRadius: 8,
              padding: '.55rem .8rem',
              boxSizing: 'border-box',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '.25rem' }}>
          <Btn onClick={props.onClose}>Hủy</Btn>
          <Btn primary disabled={!canSubmit} onClick={submit}>
            Đăng tin
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function ApplicationForm(props: {
  postings: { id: string; title: string }[];
  onClose: () => void;
  onSubmit: (v: {
    posting_id: string;
    full_name: string;
    email: string;
    phone: string;
    source: string;
    cover_note: string;
    cv_file_url: string;
  }) => Promise<void>;
}) {
  const [postingId, setPostingId] = useState(props.postings[0]?.id ?? '');
  const [fullName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('WEBSITE');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit =
    !!postingId && fullName.trim().length > 0 && /.+@.+\..+/.test(email) && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await props.onSubmit({
        posting_id: postingId,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        source,
        cover_note: note.trim(),
        cv_file_url: '',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Hồ sơ ứng viên mới" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.7rem' }}>
        <Field label="Ứng tuyển vị trí *">
          <Select value={postingId} onChange={(e) => setPostingId(e.target.value)} style={{ width: '100%' }}>
            {props.postings.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Họ tên *">
          <Input placeholder="Nguyễn Văn A" value={fullName} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
          <Field label="Email *">
            <Input placeholder="a@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Điện thoại">
            <Input placeholder="09xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
          <Field label="Nguồn">
            <Select value={source} onChange={(e) => setSource(e.target.value)} style={{ width: '100%' }}>
              <option value="WEBSITE">Website</option>
              <option value="REFERRAL">Giới thiệu</option>
              <option value="LINKEDIN">LinkedIn</option>
              <option value="EVENT">Sự kiện</option>
              <option value="OTHER">Khác</option>
            </Select>
          </Field>
          <Field label="Ghi chú">
            <Input placeholder="Ghi chú ngắn" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '.25rem' }}>
          <Btn onClick={props.onClose}>Hủy</Btn>
          <Btn primary disabled={!canSubmit} onClick={submit}>
            Lưu hồ sơ
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function InterviewForm(props: {
  name: string;
  onClose: () => void;
  onSubmit: (v: {
    interviewers: string;
    scheduled_at: string;
    location: string;
    meeting_link: string;
    notes: string;
  }) => Promise<void>;
}) {
  const [interviewers, setInterviewers] = useState('');
  const [when, setWhen] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = !!when && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await props.onSubmit({
        interviewers: interviewers.trim(),
        scheduled_at: new Date(when).toISOString(),
        location: location.trim(),
        meeting_link: link.trim(),
        notes: '',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Hẹn phỏng vấn — ${props.name}`} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.7rem' }}>
        <Field label="Hội đồng phỏng vấn">
          <Input
            placeholder="VD: Trần Văn B, Lê Thị C"
            value={interviewers}
            onChange={(e) => setInterviewers(e.target.value)}
          />
        </Field>
        <Field label="Thời gian *">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label="Địa điểm">
          <Input placeholder="Phòng họp / Online" value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Link họp (nếu online)">
          <Input placeholder="https://meet..." value={link} onChange={(e) => setLink(e.target.value)} />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '.25rem' }}>
          <Btn onClick={props.onClose}>Hủy</Btn>
          <Btn primary disabled={!canSubmit} onClick={submit}>
            Đặt lịch
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function OfferForm(props: {
  name: string;
  onClose: () => void;
  onSubmit: (v: { salary_offered: number; start_date: string }) => Promise<void>;
}) {
  const [salary, setSalary] = useState('20000000');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const canSubmit = Number(salary) > 0 && !!start && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await props.onSubmit({ salary_offered: Number(salary) || 0, start_date: start });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Offer — ${props.name}`} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.7rem' }}>
        <Field label="Lương offer (VND) *">
          <Input inputMode="numeric" value={salary} onChange={(e) => setSalary(e.target.value)} />
        </Field>
        <Field label="Ngày bắt đầu *">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <div style={{ color: C.muted, fontSize: '.8rem' }}>
          Dự kiến: <b style={{ color: C.text }}>{formatVND(Number(salary) || 0)}</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '.25rem' }}>
          <Btn onClick={props.onClose}>Hủy</Btn>
          <Btn primary disabled={!canSubmit} onClick={submit}>
            Gửi offer
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
