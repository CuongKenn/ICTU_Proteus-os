// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ShieldCheck, AlertCircle } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bg-base to-[#0a1128] p-4 relative overflow-hidden">
      {/* Subtle Glow Animation Background */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px] animate-pulse-slow pointer-events-none delay-1000" />

      <div className="glass-card w-full max-w-md p-8 flex flex-col items-center gap-6 z-10 animate-fade-in relative">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mb-2">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-text-primary">Proteus OS</h1>
          <p className="text-sm text-text-secondary">
            Hệ điều hành Đa năng cho Tổ chức
          </p>
        </div>

        {error === "RefreshAccessTokenError" && (
          <div className="w-full bg-danger/10 border border-danger/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-danger">
              Phiên làm việc đã hết hạn. Dữ liệu đang nhập dở sẽ được tự động khôi phục sau khi bạn đăng nhập lại.
            </p>
          </div>
        )}

        <div className="w-full pt-4">
          <Button
            variant="primary"
            className="w-full text-lg h-12"
            onClick={handleLogin}
            disabled={isLoading}
            isLoading={isLoading}
          >
            Đăng nhập với SSO
          </Button>
        </div>
        
        <p className="text-xs text-text-disabled mt-4 text-center">
          Bảo mật bởi Keycloak &bull; Copyright &copy; 2026 CuongKenn &amp; ICTU Team
        </p>
      </div>
    </div>
  );
};
