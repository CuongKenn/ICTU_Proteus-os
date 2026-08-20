// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ShieldCheck, AlertCircle, Cpu, Network, LockKeyhole, ArrowRight } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";

export const LoginForm: React.FC = () => {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [isLoading, setIsLoading] = useState(false);
  const addToast = useNotificationStore((state) => state.addToast);

  // Show toast if there's an error on mount
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
    // next-auth signIn will automatically redirect to keycloak
    await signIn("keycloak", { callbackUrl });
  };

  return (
    <div className="min-h-screen flex w-full bg-[#050B14] relative overflow-hidden">
      {/* Left Panel - Hidden on Mobile */}
      <div className="hidden lg:flex flex-1 relative flex-col justify-between p-12 overflow-hidden border-r border-border/30">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,var(--color-primary)_0%,transparent_50%)] opacity-[0.08] mix-blend-screen animate-pulse-slow" />
          <div className="absolute top-1/2 left-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,var(--color-accent)_0%,transparent_50%)] opacity-[0.05] mix-blend-screen animate-pulse-slow delay-700 -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02] mix-blend-overlay" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 animate-slide-up">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">Proteus OS</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg space-y-10 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 leading-tight mb-4">
              Hệ điều hành <br/>Đa năng cho Tổ chức
            </h2>
            <p className="text-lg text-text-secondary leading-relaxed">
              Kiến trúc Hexagonal mạnh mẽ, linh hoạt và bảo mật. Sẵn sàng cho mọi nhu cầu chuyển đổi số của doanh nghiệp bạn.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Network className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Kiến trúc Micro-frontends</h4>
                <p className="text-sm text-text-secondary">Tích hợp module dễ dàng không giới hạn.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                <LockKeyhole className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Bảo mật cấp Enterprise</h4>
                <p className="text-sm text-text-secondary">Định danh tập trung SSO qua Keycloak.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-text-disabled animate-fade-in" style={{ animationDelay: '400ms' }}>
          &copy; 2026 CuongKenn &amp; ICTU Team. All rights reserved.<br/>
          Mã nguồn mở theo giấy phép AGPL-3.0-or-later.
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative">
        {/* Mobile Logo (hidden on desktop) */}
        <div className="lg:hidden flex items-center gap-2 mb-8 absolute top-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Proteus OS</span>
        </div>

        <div className="w-full max-w-[420px] animate-fade-in">
          <div className="glass-card p-8 sm:p-10 flex flex-col gap-8 shadow-2xl shadow-black/50 border-white/10">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Chào mừng trở lại</h1>
              <p className="text-sm text-text-secondary">
                Đăng nhập để tiếp tục vào workspace của bạn.
              </p>
            </div>

            {error === "RefreshAccessTokenError" && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                <p className="text-sm text-danger">
                  Phiên làm việc đã hết hạn. Dữ liệu đang nhập dở sẽ được tự động khôi phục sau khi đăng nhập lại.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <Button
                variant="primary"
                className="w-full h-12 text-[15px] font-medium flex items-center justify-between group overflow-hidden relative"
                onClick={handleLogin}
                disabled={isLoading}
                isLoading={isLoading}
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  Đăng nhập với SSO
                </span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <p className="text-center text-xs text-text-disabled mt-4">
                Được bảo vệ bằng Keycloak Identity Provider
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
