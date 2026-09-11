// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Session cookie helpers — single source of truth cho tên/domain cookie.
// Dùng chung giữa authOptions (lúc sign-in) và BFF proxy (lúc persist token
// sau inline refresh). Lệch nhau là browser gửi cookie mà server không đọc.

export const SESSION_MAX_AGE = 8 * 60 * 60; // 8 giờ, khớp session.maxAge

export function isSecureCookies(): boolean {
  return (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
}

export function sessionCookieName(): string {
  return isSecureCookies()
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

/** Domain chia sẻ *.proteus.local; localhost dev giữ host-only. */
export function sessionCookieDomain(): string | undefined {
  try {
    const host = new URL(process.env.NEXTAUTH_URL ?? "").hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return undefined;
    }
    const parts = host.split(".");
    if (parts.length < 2) return undefined;
    return "." + parts.slice(-2).join(".");
  } catch {
    return undefined;
  }
}
