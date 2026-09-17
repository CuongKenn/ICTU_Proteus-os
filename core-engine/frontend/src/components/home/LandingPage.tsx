// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { useLang } from "@/components/i18n/LanguageContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";

/* ===== Intersection Observer hook for fade-up ===== */
function useFadeUp() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = el.querySelectorAll('.fade-up');
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
      { threshold: 0.05, rootMargin: '50px 0px' }
    );
    targets.forEach((t) => observer.observe(t));
    // Fallback: make all visible after 600ms regardless
    const fallback = setTimeout(() => targets.forEach((t) => t.classList.add('visible')), 600);
    return () => { observer.disconnect(); clearTimeout(fallback); };
  }, []);
  return ref;
}

/* ===== SVG Icons ===== */
const IconArrowRight = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>;
const IconBolt = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>;
const IconChart = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>;
const IconShield = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>;
const IconUsers = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
const IconDatabase = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>;
const IconBrain = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>;

export function LandingPage() {
  const { t } = useLang();
  const containerRef = useFadeUp();

  const features = [
    { step: "01", tag: "[H] HUMAN", title: t("features.h.title"), desc: t("features.h.desc"), icon: <IconUsers />, chips: ["🔐 Keycloak SSO", "💬 Mattermost", "📖 Outline"], color: "var(--accent)" },
    { step: "02", tag: "[P] PROCESS", title: t("features.p.title"), desc: t("features.p.desc"), icon: <IconBolt />, chips: ["⚙️ n8n Workflow", "🖥️ Appsmith", "✅ Poka-yoke"], color: "var(--emerald)" },
    { step: "03", tag: "[D] DATA", title: t("features.d.title"), desc: t("features.d.desc"), icon: <IconDatabase />, chips: ["🐘 PostgreSQL + RLS", "📊 Metabase BI", "🔮 Qdrant"], color: "var(--amber)" },
    { step: "04", tag: "[I] INTELLIGENCE", title: t("features.i.title"), desc: t("features.i.desc"), icon: <IconBrain />, chips: ["🤖 LangChain", "🔗 DX-DSL", "👁️ Human-in-loop"], color: "var(--violet)" },
  ];

  return (
    <div ref={containerRef} className="font-body overflow-x-hidden" style={{ color: "var(--ink)" }}>
      {/* ===== NAVBAR ===== */}
      <nav
        className="sticky top-0 z-50"
        style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)", backdropFilter: "blur(12px)" }}
      >
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-12 lg:px-16">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo + Nav Links */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center font-grot font-bold text-white text-xs" style={{ background: "var(--accent)" }}>P</div>
                <span className="font-grot text-lg font-medium tracking-tight" style={{ color: "var(--ink)" }}>
                  Proteus <span style={{ color: "var(--accent)" }}>OS</span>
                </span>
              </Link>

              <div className="hidden md:flex items-center gap-6">
                {[
                  { label: t("nav.features"), href: "#features" },
                  { label: t("nav.ai"), href: "#ai" },
                  { label: t("nav.docs"), href: "https://github.com/CuongKenn/ICTU_Proteus-os/tree/main/docs" },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="font-mono text-meta font-medium uppercase transition-colors duration-200"
                    style={{ color: "var(--muted)", letterSpacing: "0.1em", fontSize: "0.6875rem" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Right: Toggles + Auth */}
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <ThemeToggle />
              <Link href="/login" className="btn-primary hidden sm:inline-flex">{t("nav.login")}</Link>
              <Link href="/signup" className="btn-accent hidden sm:inline-flex">{t("nav.signup")}</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-12 md:pt-16 pb-16 md:pb-24 px-4 md:px-8">
        <div className="grid-bg" />

        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-bento items-start">
            {/* Left: Text */}
            <div className="lg:col-span-7 flex flex-col items-start z-10">
              <div className="fade-up mono-tag mb-8">
                <span className="pulse-dot" />
                <span>{t("hero.badge")}</span>
              </div>

              <h1 className="fade-up d1 font-grot text-hero mb-6" style={{ color: "var(--ink)" }}>
                {t("hero.title1")}{" "}
                <br />
                <span className="font-display italic font-normal" style={{ color: "var(--accent)", letterSpacing: "-0.02em" }}>
                  {t("hero.title2")}
                </span>
                <br />
                {t("hero.title3")}
              </h1>

              <p className="fade-up d2 text-[0.9375rem] leading-relaxed max-w-lg mb-10" style={{ color: "var(--muted)" }}>
                {t("hero.desc")}
              </p>

              <div className="fade-up d3 flex flex-wrap items-center gap-3">
                <Link href="/signup" className="btn-accent btn-lg">{t("hero.cta1")} <IconArrowRight /></Link>
                <a href="https://github.com/CuongKenn/ICTU_Proteus-os" target="_blank" rel="noopener noreferrer" className="btn-ghost btn-lg">{t("hero.cta2")}</a>
              </div>
            </div>

            {/* Right: Terminal Mockup */}
            <div className="lg:col-span-5 fade-up d3 hidden md:block mt-4">
              <div className="card p-0">
                {/* Window bar */}
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#EF4444" }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#F59E0B" }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#22C55E" }} />
                  </div>
                  <span className="font-mono text-[0.625rem] ml-2" style={{ color: "var(--dim)" }}>proteus-os — pipeline</span>
                </div>
                {/* Terminal body — always dark */}
                <div className="p-5 font-mono text-[0.75rem] leading-[1.8] space-y-0.5 rounded-b-card" style={{ background: "var(--plate)", color: "var(--ghost)" }}>
                  <div><span style={{ color: "var(--dim)" }}>$</span> <span style={{ color: "var(--accent)" }}>proteus</span> deploy --tenant acme-corp</div>
                  <div style={{ color: "var(--emerald)" }}>  ✓ Keycloak SSO configured</div>
                  <div style={{ color: "var(--emerald)" }}>  ✓ PostgreSQL + RLS initialized</div>
                  <div style={{ color: "var(--emerald)" }}>  ✓ Mattermost workspace created</div>
                  <div style={{ color: "var(--emerald)" }}>  ✓ n8n workflows deployed</div>
                  <div>&nbsp;</div>
                  <div className="flex items-center gap-2"><span className="pulse-dot" style={{ width: 5, height: 5 }} /> <span style={{ color: "var(--amber)" }}>AI Orchestrator: online</span></div>
                  <div style={{ color: "var(--accent)" }}>→ Dashboard: https://acme.proteus.cloud</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <div style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--paper-raised)" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-12 py-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {[
              { number: "18+", label: t("stats.api") },
              { number: "10+", label: t("stats.tools") },
              { number: "3", label: t("stats.modes") },
              { number: "8", label: t("stats.docs") },
              { number: "100%", label: t("stats.docker") },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-grot font-bold" style={{ color: "var(--ink)" }}>{stat.number}</div>
                <div className="font-mono text-meta mt-1" style={{ color: "var(--dim)" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== FEATURES SECTION ===== */}
      <section id="features" className="px-4 md:px-8" style={{ paddingTop: "var(--section-pad)", paddingBottom: "var(--section-pad)" }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-14 fade-up">
            <h2 className="text-3xl md:text-4xl font-grot font-bold mb-4" style={{ color: "var(--ink)" }}>{t("features.title")}</h2>
            <p className="max-w-2xl mx-auto" style={{ color: "var(--muted)", fontSize: "0.9375rem" }}>{t("features.desc")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-bento">
            {features.map((item) => (
              <div key={item.step} className="card p-7 fade-up">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${item.color}11`, color: item.color, border: `1px solid ${item.color}22` }}>
                    {item.icon}
                  </div>
                  <span className="font-mono text-meta" style={{ color: "var(--dim)" }}>S-{item.step}</span>
                </div>
                <span className="font-mono text-meta font-medium mb-3 block" style={{ color: item.color }}>{item.tag}</span>
                <h3 className="text-lg font-grot font-semibold mb-2" style={{ color: "var(--ink)" }}>{item.title}</h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--muted)" }}>{item.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {item.chips.map((chip) => (
                    <span key={chip} className="text-[11px] px-2.5 py-1 rounded-md" style={{ color: "var(--muted)", background: "var(--paper)", border: "1px solid var(--line)" }}>{chip}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== AI SECTION ===== */}
      <section id="ai" style={{ borderTop: "1px solid var(--line)", background: "var(--paper-raised)", paddingTop: "var(--section-pad)", paddingBottom: "var(--section-pad)" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-12">
          <div className="text-center mb-14 fade-up">
            <h2 className="text-3xl md:text-4xl font-grot font-bold mb-4" style={{ color: "var(--ink)" }}>{t("ai.title")}</h2>
            <p className="max-w-2xl mx-auto" style={{ color: "var(--muted)", fontSize: "0.9375rem" }}>{t("ai.desc")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-bento fade-up">
            {[
              { icon: <IconChart />, title: t("ai.rag.title"), desc: "Hỏi-đáp dựa trên tài liệu nội bộ (Qdrant Hybrid Search). Trả lời có trích nguồn.", badge: "Read-only", badgeColor: "var(--emerald)", badgeBg: "var(--emerald-fill)" },
              { icon: <IconBolt />, title: t("ai.monitor.title"), desc: "Giám sát 24/7 dữ liệu PostgreSQL. Phát hiện điểm nghẽn và gửi cảnh báo Mattermost.", badge: "Report Only", badgeColor: "var(--amber)", badgeBg: "var(--amber-fill)" },
              { icon: <IconShield />, title: t("ai.exec.title"), desc: "Nhận lệnh ngôn ngữ tự nhiên → ReAct reasoning → DX-DSL → gọi n8n workflow.", badge: "Approval Required", badgeColor: "var(--rose)", badgeBg: "var(--rose-fill)" },
            ].map((mode) => (
              <div key={mode.title} className="card p-7 fade-up">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  {mode.icon}
                </div>
                <h3 className="text-lg font-grot font-semibold mb-2" style={{ color: "var(--ink)" }}>{mode.title}</h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--muted)" }}>{mode.desc}</p>
                <span className="font-mono text-meta font-medium px-2.5 py-1 rounded-md" style={{ color: mode.badgeColor, background: mode.badgeBg }}>
                  {mode.badge}
                </span>
              </div>
            ))}
          </div>

          {/* HITL Banner */}
          <div className="card p-5 mt-8 flex items-start gap-4 fade-up" style={{ borderColor: "var(--accent-glow)" }}>
            <IconShield />
            <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              <strong style={{ color: "var(--ink)" }}>🔒 Human-in-the-Loop:</strong> {t("ai.hitl")}
            </p>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer style={{ borderTop: "1px solid var(--line)" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-12 py-8 flex flex-col md:flex-row items-center justify-between text-sm" style={{ color: "var(--dim)" }}>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[8px] font-bold" style={{ background: "var(--accent)" }}>P</div>
            <span className="font-mono text-[0.6875rem]">© 2026 CuongKenn & ICTU Team · AGPL-3.0</span>
          </div>
          <div className="flex gap-6 mt-4 md:mt-0">
            <span className="font-mono text-[0.6875rem] cursor-pointer transition-colors" style={{ color: "var(--dim)" }}>{t("footer.terms")}</span>
            <span className="font-mono text-[0.6875rem] cursor-pointer transition-colors" style={{ color: "var(--dim)" }}>{t("footer.privacy")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
