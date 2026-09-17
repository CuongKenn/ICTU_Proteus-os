// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Lang = "vi" | "en";

// Simple dictionary — extend as needed
const translations: Record<string, Record<Lang, string>> = {
  // Navbar
  "nav.features": { vi: "Tính năng", en: "Features" },
  "nav.ai": { vi: "Agentic AI", en: "Agentic AI" },
  "nav.marketplace": { vi: "Marketplace", en: "Marketplace" },
  "nav.docs": { vi: "Tài liệu", en: "Docs" },
  "nav.login": { vi: "Đăng nhập", en: "Sign In" },
  "nav.signup": { vi: "Đăng ký", en: "Sign Up" },
  "nav.launchpad": { vi: "Bảng điều khiển", en: "Dashboard" },
  "nav.settings": { vi: "Cài đặt", en: "Settings" },

  // Hero
  "hero.badge": { vi: "Nền tảng doanh nghiệp · Proteus OS · V2.0", en: "Enterprise Platform · Proteus OS · V2.0" },
  "hero.title1": { vi: "Hệ điều hành", en: "Universal OS" },
  "hero.title2": { vi: "Đa năng", en: "for Every" },
  "hero.title3": { vi: "cho mọi Tổ chức", en: "Organization" },
  "hero.desc": { vi: "Đập tan ốc đảo thông tin, tự động hóa toàn bộ quy trình và nhúng AI Tự hành vào mọi ngóc ngách vận hành.", en: "Break information silos, automate every workflow, and embed Agentic AI into every corner of your operations." },
  "hero.cta1": { vi: "Bắt đầu miễn phí", en: "Get Started Free" },
  "hero.cta2": { vi: "Xem trên GitHub", en: "View on GitHub" },
  "hero.learnmore": { vi: "Tìm hiểu thêm", en: "Learn More" },

  // Stats
  "stats.api": { vi: "API Endpoints", en: "API Endpoints" },
  "stats.tools": { vi: "Công cụ mã nguồn mở", en: "Open-Source Tools" },
  "stats.modes": { vi: "Chế độ AI Agent", en: "AI Agent Modes" },
  "stats.docs": { vi: "Tài liệu Chi tiết", en: "Detailed Docs" },
  "stats.docker": { vi: "Docker Containerized", en: "Docker Containerized" },

  // Features
  "features.title": { vi: "Bốn trụ cột H-P-D-I", en: "Four H-P-D-I Pillars" },
  "features.desc": { vi: "Bốn không gian kết hợp tạo vòng lặp thông minh: Con người → Quy trình → Dữ liệu → Trí tuệ.", en: "Four interconnected spaces forming an intelligent loop: Human → Process → Data → Intelligence." },
  "features.h.title": { vi: "Môi trường làm việc số tích hợp", en: "Integrated Digital Workspace" },
  "features.h.desc": { vi: "Đăng nhập 1 lần qua Keycloak SSO, truy cập toàn bộ. Giao tiếp Mattermost, tri thức với Outline Wiki.", en: "Single sign-on via Keycloak SSO, access everything. Communicate via Mattermost, knowledge with Outline Wiki." },
  "features.p.title": { vi: "Tự động hóa Workflow Event-Driven", en: "Event-Driven Workflow Automation" },
  "features.p.desc": { vi: "Form Appsmith → n8n workflow tự động. Poka-yoke validation chặn dữ liệu rác ngay tại giao diện.", en: "Appsmith forms → n8n auto-workflow. Poka-yoke validation catches bad data at the UI level." },
  "features.d.title": { vi: "Nguồn sự thật duy nhất (Unified DB)", en: "Single Source of Truth (Unified DB)" },
  "features.d.desc": { vi: "PostgreSQL + RLS cô lập Multi-Tenant. Metabase cung cấp 3 cấp phân tích.", en: "PostgreSQL + RLS for Multi-Tenant isolation. Metabase provides 3 analytics levels." },
  "features.i.title": { vi: "Trí tuệ Nhân tạo Tự hành (Agentic)", en: "Agentic Artificial Intelligence" },
  "features.i.desc": { vi: "AI nhúng sâu, giám sát 24/7, phát hiện điểm nghẽn và thực thi lệnh thay mặt Ban Giám Đốc.", en: "Deeply embedded AI, 24/7 monitoring, bottleneck detection, and autonomous command execution." },

  // AI Section
  "ai.title": { vi: "3 chế độ AI Tự hành", en: "3 Agentic AI Modes" },
  "ai.desc": { vi: "AI được trao 3 cấp quyền khác nhau, đảm bảo an toàn tuyệt đối với nguyên tắc Human-in-the-loop.", en: "AI is granted 3 different permission levels, ensuring absolute safety with the Human-in-the-loop principle." },
  "ai.rag.title": { vi: "RAG Assistant", en: "RAG Assistant" },
  "ai.monitor.title": { vi: "Proactive Monitor", en: "Proactive Monitor" },
  "ai.exec.title": { vi: "Executive Agent", en: "Executive Agent" },
  "ai.hitl": { vi: "Trước khi AI gọi bất kỳ webhook/API ghi dữ liệu nào, hệ thống BẮT BUỘC gửi Interactive Message qua Mattermost yêu cầu phê duyệt.", en: "Before AI calls any data-writing webhook/API, the system MUST send an Interactive Message via Mattermost requesting approval." },

  // Auth
  "auth.welcome": { vi: "Chào mừng trở lại", en: "Welcome back" },
  "auth.login_desc": { vi: "Đăng nhập để tiếp tục vào workspace của bạn.", en: "Sign in to continue to your workspace." },
  "auth.login_sso": { vi: "Đăng nhập với SSO", en: "Sign in with SSO" },
  "auth.protected": { vi: "Được bảo vệ bằng Keycloak Identity Provider", en: "Protected by Keycloak Identity Provider" },
  "auth.signup_title": { vi: "Khởi tạo không gian", en: "Create Workspace" },
  "auth.company": { vi: "Tên tổ chức / Công ty", en: "Organization Name" },
  "auth.admin_name": { vi: "Họ tên quản trị viên", en: "Admin Full Name" },
  "auth.email": { vi: "Email quản trị", en: "Admin Email" },
  "auth.password": { vi: "Mật khẩu", en: "Password" },
  "auth.confirm_password": { vi: "Xác nhận mật khẩu", en: "Confirm Password" },
  "auth.signup_btn": { vi: "Đăng ký ngay", en: "Sign Up" },
  "auth.has_account": { vi: "Đã có tài khoản?", en: "Already have an account?" },

  // Launchpad
  "launchpad.morning": { vi: "sáng", en: "morning" },
  "launchpad.afternoon": { vi: "chiều", en: "afternoon" },
  "launchpad.evening": { vi: "tối", en: "evening" },
  "launchpad.system": { vi: "Hệ thống", en: "System" },
  "launchpad.plugins": { vi: "Ứng dụng cài đặt", en: "Installed Apps" },
  "launchpad.no_plugins": { vi: "Chưa có Plugin nào", en: "No Plugins Yet" },
  "launchpad.explore": { vi: "Khám phá Marketplace", en: "Explore Marketplace" },

  // Footer
  "footer.terms": { vi: "Điều khoản", en: "Terms" },
  "footer.privacy": { vi: "Bảo mật", en: "Privacy" },
};

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "vi",
  setLang: () => {},
  t: (key) => key,
});

export const useLang = () => useContext(LanguageContext);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>("vi");

  useEffect(() => {
    const stored = localStorage.getItem("proteus-lang") as Lang | null;
    if (stored === "vi" || stored === "en") {
      setLangState(stored);
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("proteus-lang", l);
  }, []);

  const t = useCallback((key: string): string => {
    return translations[key]?.[lang] || key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
