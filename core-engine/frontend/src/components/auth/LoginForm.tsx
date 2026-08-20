// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ShieldCheck, AlertCircle, LayoutGrid, Zap, Shield } from "lucide-react";
import { clsx } from "clsx";
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
    <div className="min-h-screen w-full flex bg-bg-base">
      {/* LEFT PANEL - Hidden on mobile, visible on lg screens */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between overflow-hidden bg-[#050B14]">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-60 animate-pulse-slow" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,_var(--tw-gradient-stops))] from-accent/20 via-transparent to-transparent opacity-60 animate-pulse-slow delay-1000" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />

        <div className="relative z-10 p-12 flex flex-col h-full">
          <div className="flex items-center gap-3 animate-fade-in-up">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-xl">Pr</span>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Proteus OS</span>
          </div>

          <div className="my-auto max-w-md animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tracking-tight leading-tight mb-6">
              Hệ điều hành Đa năng cho Tổ chức Việt Nam
            </h2>
            <p className="text-lg text-white/60 mb-12 leading-relaxed">
              Kiến trúc đa hình, tích hợp AI mạnh mẽ và bảo mật cấp doanh nghiệp. Sẵn sàng mở rộng quy mô cùng doanh nghiệp của bạn.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 shrink-0">
                  <LayoutGrid className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">All-in-One Workspace</h3>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Giao diện hợp nhất cho mọi công cụ làm việc của tổ chức.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 shrink-0">
                  <Zap className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">AI-Powered Automation</h3>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Tích hợp tác tử AI tự động hóa quy trình nghiệp vụ phức tạp.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 shrink-0">
                  <Shield className="w-6 h-6 text-success" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Enterprise Security</h3>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Bảo vệ dữ liệu toàn diện với hệ thống quản lý danh tính Keycloak.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-white/40 text-sm font-medium flex gap-4 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <span>Trusted by ICTU</span>
            <span>&bull;</span>
            <span>AGPL-3.0 License</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative overflow-hidden bg-bg-base">
        {/* Mobile Background Elements */}
        <div className="lg:hidden absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
        <div className="lg:hidden absolute bottom-0 inset-x-0 h-64 bg-gradient-to-t from-accent/5 to-transparent pointer-events-none" />

        <div className="w-full max-w-md relative z-10 animate-fade-in">
          <div className="bg-bg-glass backdrop-blur-3xl rounded-3xl p-8 sm:p-10 border border-border/50 shadow-[0_0_40px_rgba(0,0,0,0.1)] relative overflow-hidden group">
            {/* Subtle glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30 mb-8 mx-auto shadow-inner animate-fade-in-up">
                <ShieldCheck className="w-8 h-8 text-primary" />
              </div>
              
              <div className="text-center space-y-3 mb-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Chào mừng trở lại</h1>
                <p className="text-base text-text-secondary">
                  Đăng nhập để truy cập không gian làm việc của bạn
                </p>
              </div>

              {error === "RefreshAccessTokenError" && (
                <div className="w-full bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-start gap-3 mb-6 animate-fade-in">
                  <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                  <p className="text-sm text-danger leading-relaxed">
                    Phiên làm việc đã hết hạn. Dữ liệu đang nhập dở sẽ được tự động khôi phục sau khi bạn đăng nhập lại.
                  </p>
                </div>
              )}

              <div className="w-full animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <Button
                  variant="primary"
                  className={clsx(
                    "w-full text-base h-14 rounded-xl font-semibold shadow-lg shadow-primary/20 transition-all duration-300",
                    !isLoading && "hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0"
                  )}
                  onClick={handleLogin}
                  disabled={isLoading}
                  isLoading={isLoading}
                >
                  Tiếp tục với SSO
                </Button>
              </div>
              
              <p className="text-sm text-text-disabled mt-8 text-center animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                Bảo mật bởi <span className="font-medium text-text-secondary">Keycloak</span> &bull; &copy; 2026 ICTU Team
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
