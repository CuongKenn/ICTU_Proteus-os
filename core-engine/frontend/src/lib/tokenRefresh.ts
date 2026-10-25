// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Token Refresh Helper — Tách biệt khỏi authOptions để tránh circular import
// trong Next.js App Router route handlers.
// Chỉ dùng process.env và fetch — không import bất kỳ NextAuth internal nào.
//
// QUAN TRỌNG: Keycloak realm bật `revokeRefreshToken=true` + `refreshTokenMaxReuse=0`
// → refresh_token là SINGLE-USE (rotate mỗi lần refresh). Vì vậy sau khi refresh
// BẮT BUỘC phải persist refresh_token mới vào session cookie, nếu không lần refresh
// sau sẽ dùng lại token cũ → "Maximum allowed refresh token reuse exceeded" → logout.
//
// Cache promise theo refresh_token (không phải global) để tránh concurrent refresh
// cùng 1 token (gây revoke), nhưng vẫn cho phép refresh với token mới.

import type { JWT } from "next-auth/jwt";

const publicIssuer = process.env.KEYCLOAK_ISSUER ?? "";
const realm = publicIssuer.split("/realms/")[1] ?? "proteus";
const internalBase = process.env.KEYCLOAK_INTERNAL_URL
  ? `${process.env.KEYCLOAK_INTERNAL_URL}/realms/${realm}`
  : publicIssuer;

// Cache theo refresh_token hiện tại: nhiều request đồng thời cùng token chỉ
// refresh 1 lần. GIỮ kết quả lại (không xoá ngay) trong một khoảng ân hạn vì
// request đang bay có thể vẫn mang refresh_token CŨ (browser chưa kịp nhận
// Set-Cookie). Nếu xoá ngay, request đó sẽ gọi Keycloak bằng token đã dùng →
// "Maximum allowed refresh token reuse exceeded" → cả session bị revoke.
const refreshCache = new Map<string, { promise: Promise<JWT>; expiresAt: number }>();
const REFRESH_CACHE_TTL_MS = 60_000; // ân hạn 60s cho cookie cũ đang trên đường
const REFRESH_CACHE_MAX_ENTRIES = 500; // chặn phình bộ nhớ

function pruneRefreshCache(now: number): void {
  refreshCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) refreshCache.delete(key);
  });
  // Nếu vẫn quá nhiều (tải cao bất thường), xoá dần entry cũ nhất.
  while (refreshCache.size > REFRESH_CACHE_MAX_ENTRIES) {
    const oldest = refreshCache.keys().next().value;
    if (oldest === undefined) break;
    refreshCache.delete(oldest);
  }
}

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number;
}

/**
 * Gọi Keycloak token endpoint để lấy access_token mới bằng refresh_token.
 * Trả về JWT đã cập nhật. Trên lỗi trả về token kèm error="RefreshAccessTokenError".
 */
export async function refreshAccessToken(token: JWT): Promise<JWT> {
  const rt = (token.refreshToken as string) ?? "";
  if (!rt) return { ...token, error: "RefreshAccessTokenError" };

  const now = Date.now();
  const cached = refreshCache.get(rt);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }
  if (cached) refreshCache.delete(rt);

  const p = (async () => {
    try {
      const tokenUrl = `${internalBase}/protocol/openid-connect/token`;
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.KEYCLOAK_CLIENT_ID ?? "",
          client_secret: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
          refresh_token: rt,
        }),
      });

      const refreshed = await response.json();

      if (!response.ok) {
        return { ...token, error: "RefreshAccessTokenError" };
      }

      return {
        ...token,
        accessToken: refreshed.access_token,
        // Keycloak rotate refresh_token → PHẢI lưu token mới.
        refreshToken: refreshed.refresh_token ?? token.refreshToken,
        accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
        error: undefined,
      };
    } catch {
      return { ...token, error: "RefreshAccessTokenError" };
    }
  })();

  // KHÔNG xoá trong finally: giữ promise theo RT cũ để request đến trễ (vẫn
  // mang cookie cũ) nhận đúng token đã xoay thay vì gọi lại Keycloak.
  refreshCache.set(rt, { promise: p, expiresAt: now + REFRESH_CACHE_TTL_MS });
  // Lỗi thì rút ngắn ân hạn để còn retry sớm (lỗi mạng có thể tạm thời).
  p.then((result) => {
    if (result?.error) {
      const entry = refreshCache.get(rt);
      if (entry) refreshCache.set(rt, { ...entry, expiresAt: Date.now() + 5_000 });
    }
  });
  pruneRefreshCache(now);
  return p;
}
