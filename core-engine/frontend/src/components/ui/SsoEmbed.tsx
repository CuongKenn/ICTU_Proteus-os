// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// SsoEmbed — Iframe nhúng dịch vụ SSO (Mattermost / Outline / Appsmith).
// Mục tiêu: login Launchpad 1 lần (Keycloak) -> mở dịch vụ không hỏi pass nữa.
// - src iframe trỏ thẳng SSO entry (VD: Mattermost /oauth/gitlab/login) để bỏ 1 click.
// - Toolbar "Đăng nhập SSO (tab mới)" mở first-party login nhằm né chặn
//   third-party cookie trong iframe (nguyên nhân 401 Invalid session khi nhúng
//   chat.* vào nttspace.online). Login xong bấm "Tải lại" là iframe nhận session.

"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  KeyRound,
  Loader2,
  RotateCw,
  X,
} from "lucide-react";

interface SsoEmbedProps {
  /** URL gốc dịch vụ, VD: https://chat.nttspace.online */
  baseUrl: string;
  /** URL bắt đầu SSO, VD: https://chat.nttspace.online/oauth/gitlab/login.
   *  Nếu bỏ trống thì dùng baseUrl. */
  ssoUrl?: string;
  title: string;
  className?: string;
  /** Key lưu trạng thái đã SSO xong (localStorage). Mỗi dịch vụ 1 key. */
  storageKey?: string;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Chỉ cho phép http/https — chặn javascript:/data: chống open-redirect/XSS. */
function isSafeEmbedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const SsoEmbed: React.FC<SsoEmbedProps> = ({
  baseUrl,
  ssoUrl,
  title,
  className = "",
  storageKey,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  // Iframe khác origin nên parent KHÔNG đọc được nó đã login hay chưa.
  // Toolbar chỉ tự gọn khi user báo xong (bấm Tải lại / Thu gọn), nhớ qua localStorage.
  const [dismissed, setDismissed] = useState(false);
  const [ssoOpened, setSsoOpened] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (localStorage.getItem(storageKey) === "done") setDismissed(true);
    } catch {
      // localStorage bị chặn thì thôi, vẫn hiện toolbar đầy đủ.
    }
  }, [storageKey]);

  const persistDone = () => {
    setDismissed(true);
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, "done");
    } catch {
      // Bỏ qua.
    }
  };

  const safeBase = useMemo(() => stripTrailingSlash(baseUrl), [baseUrl]);
  // Iframe LUÔN load baseUrl (trang login của dịch vụ, vốn cho phép nhúng).
  // Không auto-redirect sang Keycloak trong iframe: Keycloak gửi
  // X-Frame-Options/CSP nên form login bị chặn, lại mất nút bấm quen thuộc.
  // Luồng SSO first-party chạy qua nút "Đăng nhập SSO" (tab mới).
  const ssoTarget = useMemo(
    () => (ssoUrl ? stripTrailingSlash(ssoUrl) : safeBase),
    [ssoUrl, safeBase]
  );
  const embedSrc = safeBase;
  const isEmbedUrlSafe = isSafeEmbedUrl(embedSrc);

  const openInNewTab = (url: string) => {
    if (!isSafeEmbedUrl(url)) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleIframeError = () => {
    setIsLoading(false);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setIframeKey((k) => k + 1);
  };

  return (
    <div className={`flex flex-col w-full h-full ${className}`}>
      {dismissed ? (
        /* Toolbar gọn sau khi SSO xong */
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/50 bg-bg-surface/40 text-sm">
          <span className="text-text-secondary">Đã kết nối {title}.</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => openInNewTab(safeBase)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-bg-surface/80 text-text-secondary hover:text-text-primary border border-border/50 transition-all"
              title="Mở dịch vụ ở tab mới"
            >
              <ExternalLink className="w-4 h-4" />
              Mở tab mới
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissed(false);
                if (storageKey) {
                  try {
                    localStorage.removeItem(storageKey);
                  } catch {
                    // Bỏ qua.
                  }
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-bg-surface/80 text-text-secondary hover:text-text-primary border border-border/50 transition-all"
              title="Hiện lại toolbar SSO"
            >
              <ChevronDown className="w-4 h-4" />
              Hiện toolbar
            </button>
          </div>
        </div>
      ) : (
      /* Toolbar SSO đầy đủ */
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border/50 bg-bg-surface/40 text-sm">
        <span className="text-text-secondary">
          {ssoOpened
            ? "Đã mở tab SSO — đăng nhập xong quay lại bấm Tải lại để ẩn thanh này."
            : "SSO tự động qua Keycloak — đã đăng nhập hệ thống thì không cần nhập mật khẩu nữa."}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              openInNewTab(ssoTarget);
              setSsoOpened(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary/10 text-brand-primary font-medium hover:bg-brand-primary/20 border border-brand-primary/20 transition-all"
            title="Mở luồng SSO ở tab mới (first-party, tránh lỗi cookie iframe)"
          >
            <KeyRound className="w-4 h-4" />
            Đăng nhập SSO
          </button>
          <button
            type="button"
            onClick={() => openInNewTab(safeBase)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-bg-surface/80 text-text-secondary hover:text-text-primary border border-border/50 transition-all"
            title="Mở dịch vụ ở tab mới"
          >
            <ExternalLink className="w-4 h-4" />
            Mở tab mới
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setIframeKey((k) => k + 1);
              persistDone();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-bg-surface/80 text-text-secondary hover:text-text-primary border border-border/50 transition-all"
            title="Tải lại iframe sau khi đã SSO ở tab mới (toolbar sẽ tự gọn)"
          >
            <RotateCw className="w-4 h-4" />
            Tải lại
          </button>
          <button
            type="button"
            onClick={persistDone}
            className="p-1.5 rounded-lg hover:bg-bg-surface/80 text-text-secondary hover:text-text-primary transition-all"
            title="Ẩn thanh này (đã đăng nhập xong)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      )}

      {/* Iframe */}
      <div className="relative flex-1 w-full h-full min-h-0">
        {!isEmbedUrlSafe ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-surface z-10 p-8 text-center">
            <p className="text-text-secondary font-medium">
              URL nhúng không hợp lệ hoặc chưa được cấu hình. Vui lòng liên hệ Admin để thiết lập.
            </p>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-surface z-10 animate-pulse">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-text-secondary font-medium animate-pulse">
                  Đang SSO tới {title}...
                </p>
              </div>
            )}
            <iframe
              key={iframeKey}
              src={embedSrc}
              title={title}
              className={`w-full h-full border-0 transition-opacity duration-300 ${
                isLoading ? "opacity-0" : "opacity-100"
              }`}
              onLoad={() => setIsLoading(false)}
              onError={handleIframeError}
              allow="microphone; camera; display-capture; autoplay; clipboard-read; clipboard-write; fullscreen"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </>
        )}
      </div>
    </div>
  );
};
