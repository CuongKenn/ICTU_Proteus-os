// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Building, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useLang } from "@/components/i18n/LanguageContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";

export function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLang();
  
  const [formData, setFormData] = useState({
    companyName: "",
    adminFullName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: formData.companyName,
          admin_full_name: formData.adminFullName,
          admin_email: formData.email,
          admin_password: formData.password
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Đăng ký thất bại");
      router.push("/login?signup_success=1");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      {/* Simple top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-grot font-bold text-white text-xs" style={{ background: "var(--accent)" }}>P</div>
          <span className="font-grot text-lg font-medium tracking-tight">Proteus <span style={{ color: "var(--accent)" }}>OS</span></span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Centered Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="card p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-grot font-bold mb-2" style={{ color: "var(--ink)" }}>{t("auth.signup_title")}</h1>
              <div className="mono-tag mx-auto mt-3">
                <span className="pulse-dot" />
                <span>PROTEUS OS · ONBOARDING</span>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl text-sm" style={{ background: "var(--rose-fill)", border: "1px solid var(--rose)", color: "var(--rose)" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="font-mono text-meta font-medium ml-1" style={{ color: "var(--dim)" }}>{t("auth.company")}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Building className="h-4 w-4" style={{ color: "var(--dim)" }} /></div>
                  <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} required className="input-field input-field-icon" placeholder="Acme Corp" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-meta font-medium ml-1" style={{ color: "var(--dim)" }}>{t("auth.admin_name")}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><User className="h-4 w-4" style={{ color: "var(--dim)" }} /></div>
                  <input type="text" name="adminFullName" value={formData.adminFullName} onChange={handleChange} required className="input-field input-field-icon" placeholder="Nguyễn Văn A" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-meta font-medium ml-1" style={{ color: "var(--dim)" }}>{t("auth.email")}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Mail className="h-4 w-4" style={{ color: "var(--dim)" }} /></div>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} required className="input-field input-field-icon" placeholder="admin@acme.com" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-meta font-medium ml-1" style={{ color: "var(--dim)" }}>{t("auth.password")}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Lock className="h-4 w-4" style={{ color: "var(--dim)" }} /></div>
                  <input type="password" name="password" value={formData.password} onChange={handleChange} required minLength={8} className="input-field input-field-icon" placeholder="••••••••" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-meta font-medium ml-1" style={{ color: "var(--dim)" }}>{t("auth.confirm_password")}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Lock className="h-4 w-4" style={{ color: "var(--dim)" }} /></div>
                  <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required minLength={8} className="input-field input-field-icon" placeholder="••••••••" />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-accent btn-lg w-full mt-6 group">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{t("auth.signup_btn")} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
              </button>
            </form>
            
            <div className="mt-8 text-center text-sm" style={{ color: "var(--dim)" }}>
              {t("auth.has_account")}{" "}
              <Link href="/login" className="font-medium transition-colors" style={{ color: "var(--accent)" }}>
                {t("nav.login")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
