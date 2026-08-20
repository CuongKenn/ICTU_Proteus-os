// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { Shield, Key, Smartphone, Clock } from "lucide-react";

export const SecurityTab = () => {
  const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://auth.proteus.local";
  const securityUrl = `${keycloakUrl}/realms/proteus/account/password`;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Cài đặt Bảo mật</h2>
        <p className="text-text-secondary text-sm mt-1">
          Quản lý bảo mật tài khoản, mật khẩu và phiên đăng nhập.
        </p>
      </div>

      <div className="grid gap-6">
        <div className="p-5 border border-border bg-bg-surface/50 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-lg">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Mật khẩu</h3>
              <p className="text-sm text-text-secondary mt-1">
                Thay đổi mật khẩu thường xuyên để bảo vệ tài khoản.
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => window.open(securityUrl, "_blank")}>
            Đổi Mật khẩu
          </Button>
        </div>

        <div className="p-5 border border-border bg-bg-surface/50 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-success/10 text-success rounded-lg">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Xác thực 2 Bước (2FA)</h3>
              <p className="text-sm text-text-secondary mt-1">
                Thêm một lớp bảo mật bổ sung cho tài khoản của bạn.
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => window.open(keycloakUrl + "/realms/proteus/account/", "_blank")}>
            Thiết lập 2FA
          </Button>
        </div>

        <div className="pt-4 border-t border-border">
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Phiên Đăng nhập Hiện tại
          </h3>
          <div className="text-sm text-text-secondary p-4 bg-bg-surface rounded-lg border border-dashed border-border flex items-center justify-center">
            Phiên đăng nhập được quản lý bởi Keycloak. 
            <a 
              href={keycloakUrl + "/realms/proteus/account/sessions"} 
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline ml-1"
            >
              Xem các phiên đăng nhập
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
