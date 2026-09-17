// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, AlertCircle, ArrowRight, Terminal } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { useLang } from "@/components/i18n/LanguageContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import Link from "next/link";

export const LoginForm: React.FC = () => {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/launchpad";
  const [isLoading, setIsLoading] = useState(false);
  const addToast = useNotificationStore((state) => state.addToast);
  const { t } = useLang();

  React.useEffect(() => {
    if (error === "RefreshAccessTokenError") {
      addToast("error", "Phiên làm việc hết hạn. Vui lòng đăng nhập lại.", 10000);
    } else if (error === "InvalidEmailDomain") {
      addToast("error", "Đăng nhập thất bại. Vui lòng sử dụng email @ictu.edu.vn.", 10000);
    } else if (error) {
      addToast("error", "Đăng nhập không thành công. Vui lòng thử lại.");
    }
  }, [error, addToast]);

  const handleLogin = async () => {
    setIsLoading(true);
    await signIn("keycloak", { callbackUrl });
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
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[420px]">
          <div className="card p-8 sm:p-10">
            <div className="space-y-2 mb-8">
              <h1 className="text-2xl font-grot font-bold" style={{ color: "var(--ink)" }}>{t("auth.welcome")}</h1>
              <p className="text-sm" style={{ color: "var(--muted)" }}>{t("auth.login_desc")}</p>
            </div>

            {error === "RefreshAccessTokenError" && (
              <div className="mb-6 p-4 rounded-xl flex items-start gap-3" style={{ background: "var(--rose-fill)", border: "1px solid var(--rose)" }}>
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--rose)" }} />
                <p className="text-sm" style={{ color: "var(--rose)" }}>
                  Phiên làm việc đã hết hạn. Dữ liệu đang nhập dở sẽ được tự động khôi phục sau khi đăng nhập lại.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="btn-accent btn-lg w-full flex items-center justify-between group"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  {t("auth.login_sso")}
                </span>
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                )}
              </button>
              <p className="text-center font-mono text-meta" style={{ color: "var(--dim)" }}>
                {t("auth.protected")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
