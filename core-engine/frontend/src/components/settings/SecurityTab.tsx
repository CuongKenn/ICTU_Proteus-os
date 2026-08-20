// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { Shield, Key, Smartphone, Clock, ExternalLink } from "lucide-react";

export const SecurityTab = () => {
  const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://auth.proteus.local";
  const accountUrl = `${keycloakUrl}/realms/proteus/account/`;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Cài đặt Bảo mật</h2>
        <p className="text-text-secondary text-sm mt-1">
          Quản lý bảo mật tài khoản và các phiên đăng nhập.
        </p>
      </div>

      <div className="grid gap-6">
        <div className="p-5 border border-border bg-bg-surface/50 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-lg">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-primary">Mật khẩu</h3>
              <p className="text-xs text-text-secondary mt-1">
                Thay đổi mật khẩu thường xuyên để bảo mật tài khoản.
              </p>
            </div>
          </div>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => window.open(accountUrl, "_blank")}
          >
            Đổi Mật khẩu <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <div className="p-5 border border-border bg-bg-surface/50 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-success/10 text-success rounded-lg">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-primary">Xác thực 2 Bước (2FA)</h3>
              <p className="text-xs text-text-secondary mt-1">
                Thêm một lớp bảo mật bổ sung cho tài khoản của bạn.
              </p>
            </div>
          </div>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => window.open(accountUrl, "_blank")}
          >
            Thiết lập 2FA <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <div className="pt-4 border-t border-border">
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Phiên Đăng nhập Hiện tại
          </h3>
          <div className="mb-4">
            <h3 className="text-sm font-medium text-text-primary">Quản lý phiên</h3>
            <p className="text-xs text-text-secondary mt-1">
              Phiên đăng nhập được quản lý thông qua Keycloak SSO.
            </p>
          </div>
          <a 
            href={accountUrl + "sessions"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:text-primary-hover flex items-center"
          >
            Xem các phiên đăng nhập <ExternalLink className="w-4 h-4 ml-1" />
          </a>
        </div>
      </div>
    </div>
  );
};
