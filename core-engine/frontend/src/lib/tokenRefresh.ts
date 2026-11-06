// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Token Refresh Helper — Tách biệt khỏi authOptions để tránh circular import
// trong Next.js App Router route handlers.
// Chỉ dùng process.env và fetch — không import bất kỳ NextAuth internal nào.

import type { JWT } from "next-auth/jwt";

const publicIssuer = process.env.KEYCLOAK_ISSUER ?? "";
const realm = publicIssuer.split("/realms/")[1] ?? "proteus";
const internalBase = process.env.KEYCLOAK_INTERNAL_URL
  ? `${process.env.KEYCLOAK_INTERNAL_URL}/realms/${realm}`
  : publicIssuer;

// Cache promise theo session/sub để tránh concurrent refresh gây lỗi revoke token ở Keycloak (Issue #686, #695)
const refreshPromises = new Map<string, Promise<JWT>>();

/**
 * Gọi Keycloak token endpoint để lấy access_token mới bằng refresh_token.
 * Dùng cho BFF Proxy khi cần refresh token mà không muốn trigger jwt callback.
 */
export async function refreshAccessToken(token: JWT): Promise<JWT> {
  const key = (token.sub as string) || "anonymous";
  const inFlight = refreshPromises.get(key);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    try {
      const tokenUrl = `${internalBase}/protocol/openid-connect/token`;
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.KEYCLOAK_CLIENT_ID ?? "",
          client_secret: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
          refresh_token: (token.refreshToken as string) ?? "",
        }),
      });

      const refreshed = await response.json();

      if (!response.ok) {
        return { ...token, error: "RefreshAccessTokenError" };
      }

      return {
        ...token,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? token.refreshToken,
        accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
        error: undefined,
      };
    } catch {
      return { ...token, error: "RefreshAccessTokenError" };
    }
  })().finally(() => {
    refreshPromises.delete(key);
  });

  refreshPromises.set(key, promise);
  return promise;
}
