// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// LandingPage — Trang giới thiệu Proteus OS.
// Dùng design token của app (brand-primary...) + motion CSS thuần túy
// (Reveal/Counter, không phụ thuộc lib animation ngoài).

"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Database,
  FileText,
  GitBranch,
  HardDrive,
  Headphones,
  KeyRound,
  Layers,
  LockKeyhole,
  MessageSquare,
  PlayCircle,
  Puzzle,
  Rocket,
  Server,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

// ─── Motion primitives ─────────────────────────────────────────

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const duration = 1400;
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(Math.round(eased * to));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}

// ─── Data ──────────────────────────────────────────────────────

const integrations = [
  "Keycloak SSO",
  "n8n Workflow",
  "Metabase BI",
  "Mattermost Chat",
  "Outline Wiki",
  "Appsmith Low-code",
  "Ollama AI",
  "PostgreSQL",
];

const metrics = [
  { value: 9, suffix: "", label: "module nghiệp vụ sẵn sàng" },
  { value: 39, suffix: "", label: "workflow tự động đang chạy" },
  { value: 100, suffix: "%", label: "AI chạy nội bộ, dữ liệu không rời máy chủ" },
  { value: 1, suffix: "", label: "workspace hợp nhất cho cả tổ chức" },
];

const modules = [
  { icon: Users, name: "HR Core", detail: "Hồ sơ, chấm công, nghỉ phép, tuyển dụng" },
  { icon: BriefcaseBusiness, name: "CRM", detail: "Lead, cơ hội, hợp đồng, CSKH" },
  { icon: ShoppingCart, name: "Mua sắm", detail: "Đề nghị, PO, hợp đồng, vendor" },
  { icon: FileText, name: "Văn bản", detail: "Công văn đến/đi, ký duyệt, lưu trữ" },
  { icon: HardDrive, name: "Tài sản", detail: "Kiểm kê, bảo trì, điều chuyển" },
  { icon: Headphones, name: "IT Helpdesk", detail: "Ticket, SLA, tri thức nội bộ" },
  { icon: GitBranch, name: "Dự án", detail: "Milestone, task, timesheet" },
  { icon: Database, name: "Tài chính", detail: "Thu chi, hóa đơn, ngân sách" },
];

const steps = [
  {
    title: "Ra lệnh bằng tiếng Việt",
    description: "Nhân viên gõ yêu cầu tự nhiên trong khung chat — không cần học cú pháp, không cần mở nhiều hệ thống.",
  },
  {
    title: "AI phân tích & dry-run",
    description: "Proteus AI hiểu intent, kiểm tra quyền, dữ liệu liên quan và mô phỏng kết quả trước khi động vào dữ liệu thật.",
  },
  {
    title: "Phê duyệt có kiểm soát",
    description: "Hành động nhạy cảm tự chuyển sang Mattermost xin phê duyệt 2 lớp. Mọi thứ đều có người chịu trách nhiệm.",
  },
  {
    title: "Thực thi & ghi log",
    description: "Workflow chạy, dashboard cập nhật realtime, audit log ghi nhận đầy đủ để truy vết bất cứ lúc nào.",
  },
];

const security = [
  {
    icon: KeyRound,
    title: "SSO tập trung",
    description: "Một tài khoản Keycloak cho mọi ứng dụng: chat, wiki, BI, low-code, workflow.",
  },
  {
    icon: LockKeyhole,
    title: "Cách ly đa tenant",
    description: "Schema riêng từng tổ chức + Row-Level Security ở tầng database, phân quyền tới từng plugin.",
  },
  {
    icon: ShieldCheck,
    title: "Audit toàn trình",
    description: "Mọi lệnh AI, phê duyệt và thao tác dữ liệu đều lưu vết không thể xóa.",
  },
  {
    icon: Server,
    title: "AI on-premise",
    description: "LLM chạy trên GPU của chính bạn. Không có byte dữ liệu nào gửi ra bên ngoài.",
  },
];

// ─── Page ──────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-base font-sans text-text-primary antialiased">
      <Navbar />
      <main>
        <Hero />
        <IntegrationStrip />
        <MetricsBand />
        <FeaturesBento />
        <ShowcaseTabs />
        <HowItWorks />
        <ModuleGrid />
        <SecurityBand />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

// ─── Navbar ────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links = [
    ["Tính năng", "#features"],
    ["Cách hoạt động", "#how"],
    ["Module", "#modules"],
    ["Bảo mật", "#security"],
  ] as const;
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-border bg-bg-base/85 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/images/proteus_logo.png"
            alt="Proteus OS"
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl object-cover shadow-lg shadow-brand-primary/25"
          />
          <span className="text-lg font-bold tracking-tight">
            Proteus<span className="text-brand-primary"> OS</span>
          </span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium text-text-secondary transition hover:text-text-primary"
            >
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/login"
            className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-text-primary sm:inline-flex"
          >
            Đăng nhập
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:-translate-y-px hover:bg-brand-primary/90"
          >
            Dùng thử miễn phí
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>
    </header>
  );
}

// ─── Hero ──────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-32 sm:pt-36">
      {/* Backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-32 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-brand-primary/20 blur-[120px]" />
        <div className="absolute right-[-10rem] top-40 h-72 w-72 rounded-full bg-brand-secondary/15 blur-[100px]" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-8 lg:px-8">
        <div>
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3.5 py-1.5 text-[13px] font-medium text-brand-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Hệ điều hành doanh nghiệp · Mã nguồn mở AGPL
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.6rem]">
              Mọi hoạt động doanh nghiệp,{" "}
              <span className="bg-gradient-to-r from-brand-primary via-[#7dd3fc] to-brand-secondary bg-clip-text text-transparent">
                gói gọn trong một workspace
              </span>
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="mt-6 max-w-xl text-base leading-7 text-text-secondary sm:text-lg sm:leading-8">
              Chat, wiki, BI, low-code, workflow và{" "}
              <strong className="font-semibold text-text-primary">Proteus AI chạy 100% nội bộ</strong> —
              nhân viên ra lệnh bằng tiếng Việt, hệ thống tự thực thi có phê duyệt, dữ liệu không bao giờ rời máy chủ.
            </p>
          </Reveal>
          <Reveal delay={260}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 py-3.5 font-semibold text-white shadow-xl shadow-brand-primary/30 transition hover:-translate-y-0.5 hover:bg-brand-primary/90"
              >
                <Rocket className="h-5 w-5" />
                Triển khai cho tổ chức
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-bg-surface/60 px-6 py-3.5 font-semibold text-text-primary backdrop-blur transition hover:-translate-y-0.5 hover:bg-bg-hover"
              >
                <PlayCircle className="h-5 w-5 text-brand-primary" />
                Vào hệ thống
              </Link>
            </div>
          </Reveal>
          <Reveal delay={340}>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
              {["Không cần thẻ tín dụng", "AI có phê duyệt 2 lớp", "Audit đầy đủ"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Product visual */}
        <Reveal delay={200} className="relative">
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-brand-primary/25 via-transparent to-brand-secondary/25 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-2xl shadow-black/50">
              <div className="flex items-center gap-1.5 border-b border-border bg-bg-base/80 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 hidden rounded-md bg-bg-surface px-2.5 py-1 font-mono text-[11px] text-text-secondary sm:block">
                  proteus.local/launchpad
                </span>
              </div>
              <Image
                src="/images/proteus_os_launchpad.png"
                alt="Giao diện Launchpad Proteus OS"
                width={1024}
                height={640}
                priority
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="h-auto w-full object-cover"
              />
            </div>

            {/* Floating: approval card */}
            <div className="animate-proteus-float absolute -left-3 top-10 hidden w-60 rounded-xl border border-border bg-bg-glass p-3.5 shadow-xl backdrop-blur-xl sm:block lg:-left-10">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <Shield className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold">Chờ phê duyệt</p>
                  <p className="text-[11px] text-text-secondary">Duyệt nghỉ phép · HR</p>
                </div>
              </div>
              <div className="mt-2.5 flex gap-2">
                <span className="flex-1 rounded-md bg-emerald-500/90 px-2 py-1.5 text-center text-[11px] font-semibold text-white">
                  Duyệt
                </span>
                <span className="flex-1 rounded-md bg-bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-text-secondary">
                  Từ chối
                </span>
              </div>
            </div>

            {/* Floating: success toast */}
            <div
              className="animate-proteus-float absolute -right-3 bottom-12 hidden items-center gap-2.5 rounded-xl border border-border bg-bg-glass p-3.5 shadow-xl backdrop-blur-xl sm:flex lg:-right-8"
              style={{ animationDelay: "1.4s" }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold">Workflow đã chạy xong</p>
                <p className="text-[11px] text-text-secondary">Onboarding nhân viên mới</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Integration strip ─────────────────────────────────────────

function IntegrationStrip() {
  const row = [...integrations, ...integrations];
  return (
    <section className="border-y border-border/60 bg-bg-surface/40 py-6">
      <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
        Tích hợp sẵn trong một nền tảng
      </p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="animate-proteus-marquee flex w-max items-center gap-3 pr-3">
          {row.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-bg-base/70 px-4 py-2 text-sm font-medium text-text-secondary"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Metrics ───────────────────────────────────────────────────

function MetricsBand() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border/60 lg:grid-cols-4">
        {metrics.map((m, i) => (
          <div key={m.label} className="bg-bg-base px-6 py-8 text-center transition hover:bg-bg-surface">
            <Reveal delay={i * 80}>
              <p className="bg-gradient-to-br from-brand-primary to-brand-secondary bg-clip-text text-4xl font-extrabold tabular-nums text-transparent sm:text-5xl">
                <Counter to={m.value} suffix={m.suffix} />
              </p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{m.label}</p>
            </Reveal>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Bento features ────────────────────────────────────────────

function FeaturesBento() {
  return (
    <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6 lg:px-8">
      <Reveal className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-primary">Vì sao Proteus OS</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          AI làm việc thật, không chỉ trả lời
        </h2>
        <p className="mt-4 text-text-secondary">
          Mỗi tính năng đều gắn với kiểm soát: quyền, phê duyệt và audit. Mạnh nhưng không bao giờ mất kiểm soát.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* AI chat mock — big card */}
        <Reveal className="md:col-span-2">
          <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-bg-surface to-bg-base p-6 transition hover:border-brand-primary/40 sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-primary/15 blur-[80px] transition group-hover:bg-brand-primary/25" />
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/15 text-brand-primary">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-xl font-bold">Proteus AI hiểu ngữ cảnh tổ chức</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">
              Hỏi bằng tiếng Việt, AI tra đúng module, đúng tenant, đúng quyền của bạn — rồi xin phê duyệt trước khi ghi dữ liệu.
            </p>
            <div className="mt-6 max-w-md space-y-3 rounded-xl border border-border bg-bg-base/80 p-4">
              <div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-brand-primary px-3.5 py-2.5 text-sm text-white">
                Duyệt nghỉ phép cho An từ mai đến hết tuần
              </div>
              <div className="w-fit max-w-[90%] rounded-xl rounded-bl-sm border border-border bg-bg-surface px-3.5 py-2.5 text-sm">
                <span className="text-text-secondary">Đã tạo lệnh </span>
                <code className="font-mono text-[12px] text-brand-primary">hr.leave.approve</code>
                <span className="text-text-secondary"> · chờ sếp duyệt trên Mattermost</span>
              </div>
              <div className="flex items-center gap-1.5 px-1">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-secondary" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-secondary" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-secondary" />
              </div>
            </div>
          </div>
        </Reveal>

        {/* Approval */}
        <Reveal delay={100}>
          <div className="flex h-full flex-col rounded-2xl border border-border bg-bg-surface/60 p-6 transition hover:border-amber-400/40 sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-xl font-bold">Phê duyệt 2 lớp</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Hành động nhạy cảm bắt buộc qua Mattermost. Không ai — kể cả AI — được bypass.
            </p>
            <div className="mt-auto flex gap-2 pt-6">
              <span className="flex-1 rounded-lg bg-emerald-500/90 px-3 py-2 text-center text-xs font-bold text-white">Duyệt</span>
              <span className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-xs font-bold text-text-secondary">Từ chối</span>
            </div>
          </div>
        </Reveal>

        {/* Dashboard mini */}
        <Reveal>
          <div className="flex h-full flex-col rounded-2xl border border-border bg-bg-surface/60 p-6 transition hover:border-brand-primary/40 sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-secondary/15 text-brand-secondary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-xl font-bold">Dashboard realtime</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Số liệu từ mọi module đổ về một màn hình duy nhất.
            </p>
            <div className="mt-auto flex items-end gap-1.5 pt-6" aria-hidden>
              {[38, 62, 45, 78, 56, 90, 70].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-brand-primary/30 to-brand-primary"
                  style={{ height: `${h * 0.9}px`, opacity: 0.55 + (i % 3) * 0.2 }}
                />
              ))}
            </div>
          </div>
        </Reveal>

        {/* Workflow */}
        <Reveal delay={80}>
          <div className="flex h-full flex-col rounded-2xl border border-border bg-bg-surface/60 p-6 transition hover:border-brand-primary/40 sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Workflow className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-xl font-bold">39 workflow chạy sẵn</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Onboarding, duyệt phép, SLA, công nợ… cài module là workflow tự gắn credential và chạy.
            </p>
            <div className="mt-auto flex items-center gap-2 pt-6 text-xs text-text-secondary">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Tất cả đang hoạt động
            </div>
          </div>
        </Reveal>

        {/* Dry-run */}
        <Reveal delay={160}>
          <div className="flex h-full flex-col rounded-2xl border border-border bg-bg-surface/60 p-6 transition hover:border-brand-primary/40 sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-xl font-bold">Dry-run trước khi ghi</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Xem trước ảnh hưởng: duyệt 12 đơn, tác động 3 bảng — rồi mới quyết định.
            </p>
            <code className="mt-auto block rounded-lg border border-border bg-bg-base px-3 py-2.5 font-mono text-[11px] text-text-secondary">
              dry_run: <span className="text-emerald-400">12 records</span> · risk:{" "}
              <span className="text-amber-400">medium</span>
            </code>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Showcase tabs ─────────────────────────────────────────────

const showcaseTabs = [
  {
    id: "launchpad",
    label: "Launchpad",
    title: "Một cổng cho mọi ứng dụng",
    description:
      "Chat, wiki, BI, low-code và module nghiệp vụ mở trong cùng workspace, điều hướng theo đúng role của từng người.",
    image: "/images/proteus_os_launchpad.png",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    title: "Cài module như cài app điện thoại",
    description:
      "Xem trước schema, workflow, dashboard; cài đặt có tracking tiến trình, nâng cấp có migration an toàn, lỗi có rollback.",
    image: "/images/proteus_os_marketplace.png",
  },
] as const;

function ShowcaseTabs() {
  const [active, setActive] = useState<(typeof showcaseTabs)[number]["id"]>("launchpad");
  const tab = showcaseTabs.find((t) => t.id === active)!;
  return (
    <section className="border-y border-border/60 bg-bg-surface/30 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-primary">Sản phẩm</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Nhìn là muốn dùng ngay</h2>
        </Reveal>
        <Reveal>
          <div className="mb-8 flex justify-center gap-2">
            {showcaseTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  active === t.id
                    ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/30"
                    : "border border-border bg-bg-base text-text-secondary hover:text-text-primary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Reveal>
        <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal key={`copy-${tab.id}`}>
            <h3 className="text-2xl font-bold">{tab.title}</h3>
            <p className="mt-3 leading-7 text-text-secondary">{tab.description}</p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-1.5 font-semibold text-brand-primary hover:gap-2.5 transition-all"
            >
              Trải nghiệm ngay <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
          <Reveal key={`img-${tab.id}`} delay={120}>
            <div className="overflow-hidden rounded-2xl border border-border bg-bg-base shadow-2xl shadow-black/40">
              <Image
                src={tab.image}
                alt={tab.title}
                width={1024}
                height={640}
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="h-auto w-full object-cover"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─── How it works ──────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8">
      <Reveal className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-primary">Cách hoạt động</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Từ câu nói tới kết quả trong 4 bước
        </h2>
      </Reveal>
      <div className="relative mx-auto max-w-3xl">
        <div className="absolute bottom-8 left-[27px] top-8 w-px bg-gradient-to-b from-brand-primary via-brand-primary/40 to-transparent" aria-hidden />
        <div className="space-y-4">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 70}>
              <div className="group relative flex gap-5 rounded-2xl border border-border bg-bg-surface/50 p-5 transition hover:border-brand-primary/40 hover:bg-bg-surface sm:p-6">
                <div className="z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary text-xl font-extrabold text-white shadow-lg shadow-brand-primary/30">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-text-secondary">{s.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Modules ───────────────────────────────────────────────────

function ModuleGrid() {
  return (
    <section id="modules" className="scroll-mt-20 border-y border-border/60 bg-bg-surface/30 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-primary">Marketplace</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            9 module, cài đúng cái cần
          </h2>
          <p className="mt-4 text-text-secondary">
            Mỗi module kèm schema, workflow, dashboard và phân quyền riêng — bật tắt theo nhu cầu từng tổ chức.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m, i) => (
            <Reveal key={m.name} delay={(i % 4) * 70}>
              <div className="group h-full rounded-2xl border border-border bg-bg-base p-5 transition duration-300 hover:-translate-y-1 hover:border-brand-primary/50 hover:shadow-xl hover:shadow-brand-primary/10">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary transition group-hover:bg-brand-primary group-hover:text-white">
                  <m.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-bold">{m.name}</h3>
                <p className="mt-1.5 text-sm leading-6 text-text-secondary">{m.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Security ──────────────────────────────────────────────────

function SecurityBand() {
  return (
    <section id="security" className="relative scroll-mt-20 overflow-hidden py-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-72 w-[50rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[110px]" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <Shield className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">Bảo mật & tuân thủ</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Dữ liệu nhạy cảm xứng đáng kiến trúc nghiêm túc
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {security.map((s, i) => (
            <Reveal key={s.title} delay={(i % 2) * 80}>
              <div className="flex h-full gap-4 rounded-2xl border border-border bg-bg-surface/60 p-6 transition hover:border-emerald-400/40">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-400">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-text-secondary">{s.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <p className="mx-auto mt-8 flex max-w-xl items-center justify-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-5 py-2.5 text-center text-sm font-medium text-emerald-300">
            <LockKeyhole className="h-4 w-4 shrink-0" />
            Cam kết: không có byte dữ liệu nào rời khỏi hạ tầng của bạn
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Final CTA + footer ────────────────────────────────────────

function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-brand-primary/25 bg-gradient-to-br from-brand-primary/15 via-bg-surface to-bg-surface px-6 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-brand-primary/20 blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-brand-secondary/20 blur-[90px]" />
          <div className="relative">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary text-white shadow-xl shadow-brand-primary/40">
              <Layers className="h-7 w-7" />
            </div>
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Gom cả hệ sinh thái vận hành về một workspace ngay hôm nay
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-text-secondary">
              Đăng ký tenant trong 2 phút, cài module đầu tiên trong 1 click, để Proteus AI lo phần việc lặp lại.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-7 py-3.5 font-semibold text-white shadow-xl shadow-brand-primary/30 transition hover:-translate-y-0.5 hover:bg-brand-primary/90"
              >
                Đăng ký SaaS miễn phí
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="https://github.com/CuongKenn/ICTU_Proteus-os"
                target="_blank"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-bg-base px-7 py-3.5 font-semibold transition hover:-translate-y-0.5 hover:bg-bg-hover"
              >
                <Puzzle className="h-5 w-5 text-brand-primary" />
                Xem mã nguồn mở
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  const cols = [
    {
      title: "Sản phẩm",
      links: [
        ["Launchpad", "/launchpad"],
        ["Marketplace", "/marketplace"],
        ["Đăng ký SaaS", "/signup"],
        ["Đăng nhập", "/login"],
      ],
    },
    {
      title: "Tài nguyên",
      links: [
        ["Mã nguồn (GitHub)", "https://github.com/CuongKenn/ICTU_Proteus-os"],
        ["Tài liệu kiến trúc", "https://github.com/CuongKenn/ICTU_Proteus-os#readme"],
      ],
    },
  ] as const;
  return (
    <footer className="border-t border-border/60 bg-bg-surface/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/proteus_logo.png"
              alt="Proteus OS"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg object-cover"
            />
            <span className="font-bold">
              Proteus<span className="text-brand-primary"> OS</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-6 text-text-secondary">
            Hệ điều hành doanh nghiệp mã nguồn mở: AI nội bộ, workflow tự động và marketplace module đa tenant.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
            <span className="animate-proteus-pulse-glow h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Hệ thống đang hoạt động
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold uppercase tracking-wider text-text-secondary">{c.title}</p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  {href.startsWith("http") ? (
                    <a href={href} target="_blank" rel="noreferrer" className="text-sm text-text-secondary transition hover:text-text-primary">
                      {label}
                    </a>
                  ) : (
                    <Link href={href} className="text-sm text-text-secondary transition hover:text-text-primary">
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Copyright © 2026 CuongKenn & ICTU Team. Giấy phép AGPL-3.0.</p>
          <p className="inline-flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-brand-primary" />
            AI on-premise · Không gửi dữ liệu ra ngoài
          </p>
        </div>
      </div>
    </footer>
  );
}
