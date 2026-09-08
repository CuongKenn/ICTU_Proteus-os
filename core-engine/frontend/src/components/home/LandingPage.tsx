// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Bot, Shield, Zap, Layers } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#05050a] text-white relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-70 pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[120px] opacity-70 pointer-events-none"></div>

      {/* Navbar */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Proteus OS</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm font-medium text-white/80 hover:text-white transition-colors">
            Đăng nhập
          </Link>
          <Link 
            href="/signup" 
            className="text-sm font-semibold px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md transition-all shadow-lg hover:shadow-white/10"
          >
            Đăng ký SaaS
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Phiên bản Enterprise v2.0
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
          Nền tảng làm việc số <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-primary animate-pulse">Hợp nhất & Tự động</span>
        </h1>
        
        <p className="text-lg md:text-xl text-white/60 max-w-2xl mb-12 font-light leading-relaxed">
          Proteus OS mang đến trải nghiệm Multi-Tenancy đỉnh cao. Tích hợp sẵn sàng các công cụ giao tiếp, quy trình tự động, biểu đồ trực quan và AI Orchestrator mạnh mẽ.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link 
            href="/signup"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-primary text-white font-semibold shadow-[0_0_20px_rgba(var(--primary-rgb,59,130,246),0.4)] hover:shadow-[0_0_40px_rgba(var(--primary-rgb,59,130,246),0.6)] hover:scale-105 transition-all"
          >
            Bắt đầu miễn phí
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link 
            href="https://github.com/CuongKenn/ICTU_Proteus-os"
            target="_blank"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 backdrop-blur-md transition-all"
          >
            Mã nguồn Github
          </Link>
        </div>
      </main>

      {/* Features Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Kiến trúc vượt trội</h2>
          <p className="text-white/50">Xây dựng trên nền tảng công nghệ mạnh mẽ và an toàn nhất.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard 
            icon={<Shield className="w-6 h-6 text-green-400" />}
            title="Bảo mật tuyệt đối"
            description="Cách ly dữ liệu (Data Isolation) với Row-Level Security, bảo vệ dữ liệu Tenant ở tầng thấp nhất của CSDL."
          />
          <FeatureCard 
            icon={<Bot className="w-6 h-6 text-purple-400" />}
            title="AI Orchestrator"
            description="Tác tử AI xử lý ngữ cảnh sâu, tự động hoá luồng quy trình (n8n) dựa trên Natural Language."
          />
          <FeatureCard 
            icon={<Zap className="w-6 h-6 text-yellow-400" />}
            title="Hexagonal Architecture"
            description="Tách biệt logic nghiệp vụ khỏi infrastructure, giúp hệ thống dễ dàng mở rộng, thay thế Provider."
          />
        </div>
      </section>
      
      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between text-white/40 text-sm">
          <p>Copyright © 2026 CuongKenn & ICTU Team. All rights reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <span className="hover:text-white/80 cursor-pointer transition-colors">Điều khoản</span>
            <span className="hover:text-white/80 cursor-pointer transition-colors">Bảo mật</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="group p-8 rounded-3xl bg-white/[0.03] border border-white/5 backdrop-blur-md hover:bg-white/[0.05] hover:border-white/10 transition-all hover:-translate-y-1">
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-white/50 leading-relaxed text-sm">{description}</p>
    </div>
  );
}
