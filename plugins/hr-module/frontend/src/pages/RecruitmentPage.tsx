// HR — Tuyển dụng (ATS P1): kanban hồ sơ + lịch phỏng vấn + offer/nhận việc.
// P2: tạo hồ sơ/phỏng vấn qua dispatcher (wf_application_received,
// wf_interview_schedule). P3: nút "AI chấm" gọi DSL hr.applications.screen.
import React, { useCallback, useEffect, useState } from 'react';
import type { Application, Interview, JobPosting, Offer } from '../types';
import { APP_STAGES, formatVND } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import {
  Btn, C, DataSourceBar, InlineError, Input, Modal, Pill, Select,
} from '../components/ui';

export function RecruitmentPage() {
  const { mode, store, reason, message } = useStore();
  const [apps, setApps] = useState<Application[]>([]);
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPosting, setShowPosting] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [schedulingFor, setSchedulingFor] = useState<Application | null>(null);
  const [offeringFor, setOfferingFor] = useState<Application | null>(null);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [a, p, i, o] = await Promise.all([
        store.listApplications(),
        store.listPostings(),
        store.listInterviews(),
        store.listOffers(),
      ]);
      setApps(a);
      setPostings(p);
      setInterviews(i);
      setOffers(o);
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

  const postingName = (id: string) =>
    postings.find((p) => p.id === id)?.title ?? '—';

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <Btn primary onClick={() => setShowPosting(true)}>+ Tin tuyển dụng</Btn>
        <Btn onClick={() => setShowApp(true)}>+ Hồ sơ ứng viên</Btn>
      </div>

      <h4 style={{ color: C.text, margin: '0 0 .5rem 0' }}>
        Tin đang mở ({postings.filter((p) => p.status === 'OPEN').length})
      </h4>
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {postings.map((p) => (
          <span
            key={p.id}
            style={{
              background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
              padding: '.4rem .7rem', fontSize: '.82rem', color: C.text,
            }}
          >
            <b>{p.title}</b> · {formatVND(p.salary_min)}–{formatVND(p.salary_max)} · {p.status}
          </span>
        ))}
        {postings.length === 0 && <span style={{ color: C.muted }}>Chưa có tin nào.</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '.75rem' }}>
        {APP_STAGES.map((st) => {
          const rows = apps.filter((a) => a.stage === st);
          return (
            <div key={st} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem' }}>
                <b style={{ color: C.text }}>{st}</b>
                <Pill text={String(rows.length)} color={C.muted} />
              </div>
              {rows.map((a) => {
                const iv = interviews.filter((x) => x.application_id === a.id);
                const offer = offers.find((o) => o.application_id === a.id);
                return (
                  <div key={a.id} style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 10, padding: '.6rem .7rem', marginBottom: '.5rem' }}>
                    <b style={{ color: '#e2e8f0', fontSize: '.88rem' }}>{a.full_name}</b>
                    <div style={{ color: '#94a3b8', fontSize: '.78rem' }}>
                      {postingName(a.posting_id)} · {a.source}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '.78rem' }}>{a.email} · {a.phone}</div>
                    {a.score !== null && (
                      <div style={{ color: '#38bdf8', fontWeight: 700 }}>Điểm AI: {a.score}/100</div>
                    )}
                    {a.score === null && !['HIRED', 'REJECTED'].includes(st) && (
                      <div style={{ marginTop: '.25rem' }}>
                        <MiniBtn
                          onClick={() =>
                            mutate(async () => {
                              try {
                                await store!.screenApplication(a.id);
                              } catch (e) {
                                // LLM local chậm (>30s) → coi như đang chạy ngầm.
                                const msg = errText(e);
                                if (!msg.includes('502') && !msg.includes('30')) throw e;
                                setError(
                                  'AI đang chấm (LLM local ~1 phút) — tải lại trang sau ít phút để xem điểm.'
                                );
                              }
                              await load();
                            })
                          }
                        >
                          AI chấm
                        </MiniBtn>
                      </div>
                    )}
                    {a.screening_notes && (
                      <div style={{ color: '#94a3b8', fontSize: '.78rem' }}>{a.screening_notes}</div>
                    )}
                    {iv.length > 0 && (
                      <div style={{ color: '#f59e0b', fontSize: '.78rem' }}>
                        PV: {iv.map((x) => `${String(x.scheduled_at).slice(0, 16)} (${x.result})`).join(', ')}
                      </div>
                    )}
                    {offer && (
                      <div style={{ color: '#22c55e', fontSize: '.78rem' }}>
                        Offer {formatVND(offer.salary_offered)} · {offer.status}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginTop: '.35rem' }}>
                      {st === 'NEW' && (
                        <MiniBtn onClick={() => mutate(() => store!.moveApplication(a.id, 'SCREENING'))}>
                          Sàng lọc
                        </MiniBtn>
                      )}
                      {st === 'SCREENING' && (
                        <MiniBtn onClick={() => setSchedulingFor(a)}>Hẹn PV</MiniBtn>
                      )}
                      {st === 'INTERVIEW' && (
                        <>
                          <MiniBtn onClick={() => setOfferingFor(a)}>Offer</MiniBtn>
                          <MiniBtn danger onClick={() => mutate(() => store!.moveApplication(a.id, 'REJECTED'))}>
                            Loại
                          </MiniBtn>
                        </>
                      )}
                      {st === 'OFFER' && !offer && (
                        <MiniBtn onClick={() => setOfferingFor(a)}>Tạo offer</MiniBtn>
                      )}
                      {st === 'OFFER' && offer && offer.status !== 'ACCEPTED' && (
                        <MiniBtn
                          onClick={() =>
                            mutate(async () => {
                              await store!.hireFromOffer(offer.id);
                            })
                          }
                        >
                          Nhận việc
                        </MiniBtn>
                      )}
                      {!['HIRED', 'REJECTED'].includes(st) && st !== 'INTERVIEW' && st !== 'OFFER' && (
                        <MiniBtn danger onClick={() => mutate(() => store!.moveApplication(a.id, 'REJECTED'))}>
                          Loại
                        </MiniBtn>
                      )}
                    </div>
                  </div>
                );
              })}
              {rows.length === 0 && <div style={{ color: C.muted, fontSize: '.8rem' }}>—</div>}
            </div>
          );
        })}
      </div>

      {showPosting && (
        <PostingForm
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

function PostingForm(props: {
  onClose: () => void;
  onSubmit: (v: Omit<JobPosting, 'id' | 'status'>) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('Thái Nguyên');
  const [min, setMin] = useState('15000000');
  const [max, setMax] = useState('25000000');
  return (
    <Modal title="Tin tuyển dụng mới" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Vị trí (VD Backend Developer)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Địa điểm" value={location} onChange={(e) => setLocation(e.target.value)} />
        <Input placeholder="Lương tối thiểu" value={min} onChange={(e) => setMin(e.target.value)} />
        <Input placeholder="Lương tối đa" value={max} onChange={(e) => setMax(e.target.value)} />
        <Btn
          primary
          onClick={() =>
            props.onSubmit({
              title, department_id: '', employment_type: 'FULLTIME', location,
              salary_min: Number(min) || 0, salary_max: Number(max) || 0,
              description: '', requirements: '',
            })
          }
        >
          Đăng tin
        </Btn>
      </div>
    </Modal>
  );
}

function ApplicationForm(props: {
  postings: { id: string; title: string }[];
  onClose: () => void;
  onSubmit: (v: { posting_id: string; full_name: string; email: string; phone: string; source: string; cover_note: string }) => Promise<void>;
}) {
  const [posting_id, setPosting] = useState(props.postings[0]?.id ?? '');
  const [full_name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  return (
    <Modal title="Hồ sơ ứng viên mới" onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Select value={posting_id} onChange={(e) => setPosting(e.target.value)}>
          {props.postings.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </Select>
        <Input placeholder="Họ tên" value={full_name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Btn
          primary
          onClick={() => props.onSubmit({ posting_id, full_name, email, phone, source: 'WEBSITE', cover_note: '' })}
        >
          Lưu hồ sơ
        </Btn>
      </div>
    </Modal>
  );
}

function InterviewForm(props: {
  name: string;
  onClose: () => void;
  onSubmit: (v: { interviewers: string; scheduled_at: string; location: string; meeting_link: string; notes: string }) => Promise<void>;
}) {
  const [interviewers, setInterviewers] = useState('');
  const [scheduled_at, setWhen] = useState('');
  const [location, setLocation] = useState('');
  return (
    <Modal title={`Hẹn phỏng vấn — ${props.name}`} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Hội đồng (VD A, B)" value={interviewers} onChange={(e) => setInterviewers(e.target.value)} />
        <Input type="datetime-local" value={scheduled_at} onChange={(e) => setWhen(e.target.value)} />
        <Input placeholder="Địa điểm / link họp" value={location} onChange={(e) => setLocation(e.target.value)} />
        <Btn
          primary
          onClick={() =>
            props.onSubmit({ interviewers, scheduled_at: scheduled_at || new Date().toISOString(), location, meeting_link: '', notes: '' })
          }
        >
          Đặt lịch
        </Btn>
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
  const [start, setStart] = useState('');
  return (
    <Modal title={`Offer — ${props.name}`} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Lương offer (VND)" value={salary} onChange={(e) => setSalary(e.target.value)} />
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Btn
          primary
          onClick={() =>
            props.onSubmit({ salary_offered: Number(salary) || 0, start_date: start || new Date().toISOString().slice(0, 10) })
          }
        >
          Gửi offer
        </Btn>
      </div>
    </Modal>
  );
}
