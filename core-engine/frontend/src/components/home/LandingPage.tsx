// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
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
  Puzzle,
  Rocket,
  Server,
  Shield,
  ShoppingCart,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

const metrics = [
  { value: "8+", label: "module nghiệp vụ" },
  { value: "1", label: "workspace hợp nhất" },
  { value: "RLS", label: "cách ly dữ liệu tenant" },
];

const outcomes = [
  {
    icon: Workflow,
    title: "Tự động hóa quy trình",
    description:
      "Biến yêu cầu tự nhiên thành workflow có kiểm soát: nhắc họp, phê duyệt nghỉ phép, xử lý ticket, duyệt mua sắm và các tác vụ vận hành lặp lại.",
  },
  {
    icon: Bot,
    title: "Proteus AI trong ngữ cảnh",
    description:
      "AI hiểu module đang dùng, dữ liệu tenant, quyền truy cập và bước phê duyệt cần thiết trước khi thực hiện hành động ghi dữ liệu.",
  },
  {
    icon: BarChart3,
    title: "Dashboard theo thời gian thực",
    description:
      "Kết nối dữ liệu nghiệp vụ với báo cáo vận hành để đội ngũ nhìn thấy backlog, chi phí, tiến độ, SLA và hiệu suất ngay trong cùng hệ thống.",
  },
];

const modules = [
  { icon: Users, name: "HR", detail: "Nhân sự, nghỉ phép, tuyển dụng" },
  { icon: BriefcaseBusiness, name: "CRM", detail: "Khách hàng, pipeline, ticket" },
  { icon: ShoppingCart, name: "Procurement", detail: "Yêu cầu mua, hợp đồng, vendor" },
  { icon: FileText, name: "Document", detail: "Công văn, phê duyệt, lưu trữ" },
  { icon: HardDrive, name: "Asset", detail: "Tài sản, bảo trì, thanh lý" },
  { icon: Headphones, name: "IT Helpdesk", detail: "Ticket, SLA, tri thức nội bộ" },
  { icon: GitBranch, name: "Project", detail: "Dự án, task, milestone" },
  { icon: Database, name: "Finance", detail: "Chi phí, hóa đơn, ngân sách" },
];

const workflowSteps = [
  "Người dùng nhập yêu cầu bằng tiếng Việt tự nhiên.",
  "AI phân tích intent, module, quyền và dữ liệu liên quan.",
  "Hệ thống chạy dry-run cho hành động nhạy cảm trước khi gửi phê duyệt.",
  "Workflow được thực thi, ghi log và cập nhật dashboard vận hành.",
];

const architecture = [
  {
    icon: Shield,
    title: "Multi-tenant by design",
    description: "Mỗi tổ chức vận hành trong không gian dữ liệu riêng, có RBAC và Row-Level Security ở tầng cơ sở dữ liệu.",
  },
  {
    icon: Server,
    title: "Backend hexagonal",
    description: "Use case nghiệp vụ tách khỏi adapter hạ tầng, giúp thay provider AI, BI, workflow hoặc chat mà không phá lõi.",
  },
  {
    icon: KeyRound,
    title: "SSO và kiểm soát truy cập",
    description: "Keycloak, JWT, role template và audit log tạo nền tảng quản trị phù hợp môi trường doanh nghiệp.",
  },
  {
    icon: Puzzle,
    title: "Plugin marketplace",
    description: "Module có manifest, migration, dashboard, workflow và micro-frontend riêng để cài đặt theo nhu cầu từng tenant.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#071013] text-white font-sans">
      <Hero />

      <main>
        <section className="border-y border-white/10 bg-[#0b1719]">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-3">
            {metrics.map((item) => (
              <div key={item.label} className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-[#6ee7e0]">{item.value}</span>
                <span className="text-sm text-white/70">{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <SectionIntro
          eyebrow="Nền tảng vận hành"
          title="Một hệ điều hành doanh nghiệp cho dữ liệu, workflow và AI"
          description="Proteus OS gom các công cụ rời rạc thành một lớp điều phối thống nhất, giúp đội ngũ làm việc trong cùng bối cảnh thay vì nhảy qua nhiều hệ thống."
        />

        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-6 pb-20 md:grid-cols-3">
          {outcomes.map((item) => (
            <InfoCard
              key={item.title}
              icon={item.icon}
              title={item.title}
              description={item.description}
            />
          ))}
        </section>

        <ProductShowcase />
        <WorkflowSection />
        <ModuleSection />
        <ArchitectureSection />
        <MarketplaceSection />
        <FinalCta />
      </main>

      <footer className="border-t border-white/10 bg-[#061013]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-white/55 md:flex-row md:items-center md:justify-between">
          <p>Copyright © 2026 CuongKenn & ICTU Team. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-white">
              Đăng nhập
            </Link>
            <Link href="/signup" className="hover:text-white">
              Đăng ký SaaS
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <header className="relative min-h-[92svh] overflow-hidden">
      <Image
        src="/images/hero_ai_network.png"
        alt="Mạng điều phối AI và dữ liệu của Proteus OS"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[#061013]/55" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,16,19,0.96)_0%,rgba(6,16,19,0.78)_38%,rgba(6,16,19,0.25)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(0deg,#071013_0%,rgba(7,16,19,0)_100%)]" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/proteus_logo.png"
            alt="Proteus OS"
            width={44}
            height={44}
            className="h-11 w-11 rounded-lg object-cover"
          />
          <span className="text-xl font-bold">Proteus OS</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm font-medium text-white/80 hover:text-white sm:inline-flex">
            Đăng nhập
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-[#071013] transition hover:bg-[#d8fffb]"
          >
            Đăng ký
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      <div className="relative z-10 mx-auto flex max-w-7xl px-6 pb-16 pt-16 sm:pt-24 lg:pt-28">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-[#6ee7e0]/30 bg-[#061013]/45 px-3 py-1.5 text-sm text-[#9df7f0] backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            Enterprise workspace cho tổ chức cần AI riêng tư
          </div>

          <h1 className="text-5xl font-bold leading-[1.04] sm:text-6xl lg:text-7xl">
            Proteus OS
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-8 text-white/80 sm:text-2xl sm:leading-9">
            Hợp nhất launchpad, workflow automation, dashboard BI, marketplace module và Proteus AI trong một nền tảng vận hành bảo mật.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#6ee7e0] px-6 py-3.5 font-semibold text-[#061013] transition hover:bg-[#9df7f0]"
            >
              Bắt đầu triển khai
              <Rocket className="h-5 w-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/25 bg-white/10 px-6 py-3.5 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Vào hệ thống
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          <div className="mt-12 grid max-w-2xl grid-cols-1 gap-3 text-sm text-white/75 sm:grid-cols-3">
            {["AI có phê duyệt", "Plugin theo tenant", "Audit-ready"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#6ee7e0]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-10 pt-20">
      <p className="mb-3 text-sm font-semibold uppercase text-[#6ee7e0]">{eyebrow}</p>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.85fr_1fr] lg:items-end">
        <h2 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h2>
        <p className="text-base leading-7 text-white/68 sm:text-lg">{description}</p>
      </div>
    </section>
  );
}

function InfoCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-[#6ee7e0]/12 text-[#6ee7e0]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/62">{description}</p>
    </article>
  );
}

function ProductShowcase() {
  return (
    <section className="bg-[#edf7f4] text-[#071013]">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase text-[#12736f]">Launchpad hợp nhất</p>
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
            Mọi ứng dụng nghiệp vụ xuất hiện trong một cổng làm việc duy nhất
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#34484a]">
            Người dùng mở module, chat nội bộ, wiki, analytics và ứng dụng low-code từ cùng một dashboard. Admin quản lý cài đặt module mà không phải ghép thủ công từng công cụ.
          </p>
          <div className="mt-8 grid gap-3">
            {["Điều hướng theo role và tenant", "Trạng thái cài đặt module rõ ràng", "Tích hợp Mattermost, Outline, Metabase, Appsmith và n8n"].map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-[#263b3d]">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#12736f]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-[#0b2f35]/12 bg-white p-2 shadow-[0_24px_80px_rgba(7,16,19,0.22)]">
          <Image
            src="/images/proteus_os_launchpad.png"
            alt="Giao diện Launchpad của Proteus OS"
            width={1024}
            height={1024}
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="h-auto w-full rounded-md object-cover"
          />
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.78fr_1fr] lg:items-start">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase text-[#6ee7e0]">AI orchestration</p>
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
            Từ câu lệnh tự nhiên đến hành động có kiểm soát
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/68">
            Proteus AI không chỉ trả lời. Nó đọc ngữ cảnh, đề xuất hành động, mô phỏng ảnh hưởng và yêu cầu phê duyệt khi thao tác có rủi ro.
          </p>
        </div>

        <div className="grid gap-3">
          {workflowSteps.map((step, index) => (
            <div key={step} className="grid grid-cols-[3rem_1fr] gap-4 rounded-lg border border-white/10 bg-white/[0.045] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#6ee7e0] font-bold text-[#061013]">
                {index + 1}
              </div>
              <div>
                <h3 className="font-semibold">Bước {index + 1}</h3>
                <p className="mt-1 text-sm leading-6 text-white/64">{step}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModuleSection() {
  return (
    <section className="border-y border-white/10 bg-[#0a1417]">
      <SectionIntro
        eyebrow="Module marketplace"
        title="Cài đúng năng lực mà từng tổ chức cần"
        description="Mỗi module đi kèm schema dữ liệu, workflow, dashboard và giao diện riêng. Tenant có thể bật tắt theo nhu cầu vận hành mà vẫn giữ cùng chuẩn bảo mật."
      />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {modules.map((item) => (
          <article key={item.name} className="rounded-lg border border-white/10 bg-[#101f22] p-5">
            <item.icon className="h-6 w-6 text-[#f7c948]" />
            <h3 className="mt-4 font-semibold">{item.name}</h3>
            <p className="mt-2 text-sm leading-6 text-white/60">{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ArchitectureSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="mb-10 flex max-w-3xl flex-col gap-4">
        <p className="text-sm font-semibold uppercase text-[#6ee7e0]">Enterprise foundation</p>
        <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
          Đủ linh hoạt cho plugin, đủ chặt chẽ cho dữ liệu nhạy cảm
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {architecture.map((item) => (
          <InfoCard
            key={item.title}
            icon={item.icon}
            title={item.title}
            description={item.description}
          />
        ))}
      </div>
    </section>
  );
}

function MarketplaceSection() {
  return (
    <section className="bg-[#102126]">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="rounded-lg border border-white/10 bg-[#071013] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <Image
            src="/images/proteus_os_marketplace.png"
            alt="Marketplace module của Proteus OS"
            width={1024}
            height={1024}
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="h-auto w-full rounded-md object-cover"
          />
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold uppercase text-[#6ee7e0]">Quản trị module</p>
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
            Marketplace giúp triển khai nhanh mà vẫn kiểm soát được thay đổi
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/68">
            Admin xem thông tin plugin, migration, workflow và dashboard trước khi cài. Các tiến trình cài đặt được theo dõi để đội vận hành biết chính xác hệ thống đang làm gì.
          </p>
          <div className="mt-8 grid gap-4">
            {[
              ["Manifest rõ ràng", "Tên module, quyền, endpoint và metadata được chuẩn hóa."],
              ["Migration có kiểm soát", "Dữ liệu nghiệp vụ được tạo theo schema module."],
              ["Dashboard đi kèm", "Báo cáo Metabase giúp đo hiệu quả ngay sau khi cài."],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-white/62">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#e7fbf7] text-[#071013]">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#6ee7e0,#f7c948,#8b5cf6)]" />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-20 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-md bg-[#071013] text-[#6ee7e0]">
            <Layers className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
            Sẵn sàng gom hệ sinh thái vận hành vào Proteus OS?
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#34484a]">
            Bắt đầu với launchpad, cài module đầu tiên, kết nối workflow và để Proteus AI hỗ trợ đội ngũ xử lý công việc hằng ngày.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#071013] px-6 py-3.5 font-semibold text-white transition hover:bg-[#153036]"
          >
            Đăng ký SaaS
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="https://github.com/CuongKenn/ICTU_Proteus-os"
            target="_blank"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#071013]/20 px-6 py-3.5 font-semibold text-[#071013] transition hover:bg-white"
          >
            Xem mã nguồn
            <Zap className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
