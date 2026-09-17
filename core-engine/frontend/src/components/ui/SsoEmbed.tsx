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
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  KeyRound,
  Loader2,
  RotateCw,
  ShieldCheck,
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
        /* Toolbar gọn sau khi SSO xong — pill trạng thái + hành động phụ */
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/80 px-4 py-2 text-sm dark:border-border/50 dark:bg-bg-surface/40">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:border-success/30 dark:bg-success/10 dark:text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Đã kết nối {title}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => openInNewTab(safeBase)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-500 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary dark:border-border/60 dark:bg-transparent dark:text-text-secondary dark:shadow-none dark:hover:border-brand-primary/50 dark:hover:text-text-primary"
              title="Mở dịch vụ ở tab mới"
            >
              <ExternalLink className="h-4 w-4" />
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
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-transparent px-3 py-1.5 text-[13px] font-semibold text-slate-400 transition-all duration-200 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary dark:text-text-disabled dark:hover:text-text-primary"
              title="Hiện lại toolbar SSO"
            >
              <ChevronDown className="h-4 w-4" />
              Hiện toolbar
            </button>
          </div>
        </div>
      ) : (
      /* Toolbar SSO đầy đủ — phân cấp primary/ghost rõ ràng */
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-2.5 text-sm dark:border-border/50 dark:bg-bg-surface/40">
        <span className="inline-flex min-w-0 items-center gap-2 text-[13px] text-slate-500 dark:text-text-secondary">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600/[0.08] ring-1 ring-indigo-600/15 dark:bg-brand-primary/10 dark:ring-brand-primary/20">
            <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-brand-primary" />
          </span>
          <span className="truncate">
            {ssoOpened
              ? "Đã mở tab SSO — đăng nhập xong quay lại bấm Tải lại để ẩn thanh này."
              : "SSO tự động qua Keycloak — đã đăng nhập hệ thống thì không cần nhập mật khẩu nữa."}
          </span>
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              openInNewTab(ssoTarget);
              setSsoOpened(true);
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-[13px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(79,70,229,0.7)] transition-all duration-200 hover:-translate-y-px hover:bg-indigo-500 active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base dark:bg-brand-primary dark:hover:bg-primary-hover dark:shadow-[0_8px_24px_-8px_hsla(245,85%,65%,0.6)]"
            title="Mở luồng SSO ở tab mới (first-party, tránh lỗi cookie iframe)"
          >
            <KeyRound className="h-4 w-4" />
            Đăng nhập SSO
          </button>
          <button
            type="button"
            onClick={() => openInNewTab(safeBase)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-500 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary dark:border-border/60 dark:bg-transparent dark:text-text-secondary dark:shadow-none dark:hover:border-brand-primary/50 dark:hover:text-text-primary"
            title="Mở dịch vụ ở tab mới"
          >
            <ExternalLink className="h-4 w-4" />
            Mở tab mới
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setIframeKey((k) => k + 1);
              persistDone();
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-500 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary dark:border-border/60 dark:bg-transparent dark:text-text-secondary dark:shadow-none dark:hover:border-brand-primary/50 dark:hover:text-text-primary"
            title="Tải lại iframe sau khi đã SSO ở tab mới (toolbar sẽ tự gọn)"
          >
            <RotateCw className="h-4 w-4" />
            Tải lại
          </button>
          <button
            type="button"
            onClick={persistDone}
            aria-label="Ẩn thanh SSO"
            title="Ẩn thanh này (đã đăng nhập xong)"
            className="cursor-pointer rounded-xl p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary dark:text-text-disabled dark:hover:bg-bg-hover dark:hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      )}

      {/* Iframe */}
      <div className="relative flex-1 w-full h-full min-h-0">
        {!isEmbedUrlSafe ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg-base p-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-danger/25 bg-danger/10">
              <AlertTriangle className="h-7 w-7 text-danger" />
            </span>
            <p className="font-display text-lg font-bold text-text-primary">Chưa cấu hình tích hợp</p>
            <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
              URL nhúng của {title} không hợp lệ hoặc chưa được cấu hình. Vui lòng liên hệ Admin để thiết lập.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-brand-primary/50 hover:text-text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <RotateCw className="h-4 w-4" />
              Thử lại
            </button>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-bg-base">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-primary/25 bg-brand-primary/10">
                  <Loader2 className="h-7 w-7 animate-spin text-brand-primary" />
                </div>
                <div className="text-center">
                  <p className="font-display text-sm font-bold text-text-primary">Đang kết nối {title}…</p>
                  <p className="mt-1 text-xs text-text-disabled">Đăng nhập SSO một lần qua Keycloak</p>
                </div>
                <div className="h-1.5 w-48 overflow-hidden rounded-full bg-bg-surface" aria-hidden="true">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary" />
                </div>
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
