// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// NextAuth options — BFF Security Pattern
// Browser KHÔNG bao giờ nhận JWT trực tiếp.
// Token được lưu trong HttpOnly session cookie do Next.js quản lý.
// Tham chiếu: docs/architecture.md (BFF Pattern), docs/clarification.md §8

import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";

// ─── Silent Token Refresh ─────────────────────────────────────
// Gọi Keycloak token endpoint để lấy access_token mới bằng refresh_token.
// Được gọi tự động khi access_token hết hạn trong JWT callback.
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const tokenUrl = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`;
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.KEYCLOAK_CLIENT_ID!,
        client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
        refresh_token: token.refreshToken as string,
      }),
    });

    const refreshed = await response.json();

    if (!response.ok) {
      // Refresh thất bại (refresh_token hết hạn hoặc bị revoke)
      // Trả về token với error để client biết cần login lại
      return { ...token, error: "RefreshAccessTokenError" };
    }

    return {
      ...token,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? token.refreshToken, // Rotate nếu có
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      error: undefined, // Xóa error cũ nếu refresh thành công
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

// ─── NextAuth Config ──────────────────────────────────────────
export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV !== "production", // Debug log in dev
  providers: [
    // Manual OAuth provider — bypass ALL OIDC discovery
    // wellKnown bị xóa: dù hardcode endpoints, wellKnown vẫn trigger OIDC discovery
    // để lấy JWKS cho ID token verification → gây 404 intermittent.
    // idToken:false → không verify ID token → không cần JWKS → không cần discovery gì cả.
    // Profile được lấy từ userinfo endpoint bằng access_token.
    {
      id: "keycloak",
      name: "Keycloak SSO",
      type: "oauth",
      // KHÔNG có wellKnown — tránh hoàn toàn OIDC discovery
      authorization: {
        url: `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/auth`,
        params: { scope: "openid email profile", response_type: "code" },
      },
      token: `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`,
      userinfo: `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/userinfo`,
      // idToken: false — không verify ID token, không cần JWKS, không cần discovery
      idToken: false,
      checks: ["pkce", "state"],
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      profile(profile: any) {
        return {
          id: profile.sub,
          name: profile.name ?? profile.preferred_username,
          email: profile.email,
          image: profile.picture ?? null,
        };
      },
    },

  ],

  callbacks: {
    async signIn() {
      // Allow any user authenticated by Keycloak — role-based access is handled by RBAC middleware
      return true;
    },

    async jwt({ token, account, profile }) {
      // Lần đầu login — lưu access_token, refresh_token và expiry vào JWT session
      if (account) {
        let roles: string[] = [];
        const kcProfile = profile as any;
        if (kcProfile?.realm_access?.roles) {
          roles = kcProfile.realm_access.roles;
        }

        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 60 * 60 * 1000, // Fallback: 1 giờ
          roles,
        };
      }

      // Token vẫn còn hạn (thêm buffer 30s để tránh edge case)
      if (Date.now() < (token.accessTokenExpires as number) - 30_000) {
        return token;
      }

      // Token sắp/đã hết hạn → Silent refresh
      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      // Expose access token cho BFF Proxy — KHÔNG expose xuống browser
      // session.accessToken = token.accessToken as string; // REMOVED for security (Issue #327)
      session.user.roles = (token.roles as string[]) ?? [];

      // Truyền lỗi refresh lên client để có thể hiển thị thông báo
      if (token.error) {
        (session as any).error = token.error;
      }

      return session;
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 giờ (session tối đa, kể cả refresh)
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};
