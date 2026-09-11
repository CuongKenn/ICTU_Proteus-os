// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// NextAuth options — BFF Security Pattern
// Browser KHÔNG bao giờ nhận JWT trực tiếp.
// Token được lưu trong HttpOnly session cookie do Next.js quản lý.
// Tham chiếu: docs/architecture.md (BFF Pattern), docs/clarification.md §8

import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import {
  SESSION_MAX_AGE,
  isSecureCookies,
  sessionCookieDomain,
  sessionCookieName,
} from "./sessionCookie";

const publicIssuer = process.env.KEYCLOAK_ISSUER || "";
const realm = publicIssuer.split("/realms/")[1] || "proteus";
const internalBase = process.env.KEYCLOAK_INTERNAL_URL
  ? `${process.env.KEYCLOAK_INTERNAL_URL}/realms/${realm}`
  : publicIssuer;

// ─── Silent Token Refresh ─────────────────────────────────────
// Gọi Keycloak token endpoint để lấy access_token mới bằng refresh_token.
// Được gọi tự động khi access_token hết hạn trong JWT callback.
// (Xem tokenRefresh.ts cho BFF Proxy version độc lập)
// Cache promise để tránh concurrent refresh (race condition) gây lỗi revoke token ở Keycloak
let refreshPromise: Promise<JWT> | null = null;

// Gọi Keycloak token endpoint để lấy access_token mới bằng refresh_token.
// Được gọi tự động khi access_token hết hạn trong JWT callback.
// (Xem tokenRefresh.ts cho BFF Proxy version độc lập)
async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const tokenUrl = `${internalBase}/protocol/openid-connect/token`;
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
  } finally {
    refreshPromise = null;
  }
})();
return refreshPromise;
}

// (dùng sessionCookie.ts — single source of truth, BFF proxy cũng dùng)

// ─── NextAuth Config ──────────────────────────────────────────
export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === "development",
  providers: [
    // Manual OAuth provider — Keycloak luôn trả id_token nên phải dùng idToken:true
    // Dùng wellKnown để NextAuth lấy jwks_uri (cho ID token verification)
    // Tất cả endpoints được hardcode để tránh dependency vào discovery cho routing
    {
      id: "keycloak",
      name: "Keycloak SSO",
      type: "oauth",
      // wellKnown cần để lấy JWKS cho ID token verification
      // Nhưng discovery chỉ xảy ra 1 lần và được cache
      wellKnown: `${internalBase}/.well-known/openid-configuration`,
      // Hardcode authorization endpoint — không phụ thuộc vào discovery cho redirect
      authorization: {
        url: `${publicIssuer}/protocol/openid-connect/auth`,
        params: { scope: "openid email profile", response_type: "code" },
      },
      // Hardcode token và userinfo endpoints
      token: `${internalBase}/protocol/openid-connect/token`,
      userinfo: `${internalBase}/protocol/openid-connect/userinfo`,
      // Thêm issuer để tránh lỗi issuer mismatch
      issuer: publicIssuer,
      // idToken: true — Keycloak luôn trả id_token, phải dùng client.callback()
      idToken: true,
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

        // Ưu tiên decode access_token để lấy realm_access.roles
        // vì Keycloak đảm bảo realm_access luôn có trong access_token.
        // id_token (profile) chỉ chứa roles nếu đã cấu hình Protocol Mapper riêng.
        if (account.access_token) {
          try {
            const payloadBase64 = account.access_token.split(".")[1];
            const decoded = JSON.parse(
              Buffer.from(payloadBase64, "base64").toString("utf-8")
            );
            if (decoded?.realm_access?.roles) {
              roles = decoded.realm_access.roles;
            }
          } catch {
            // Fallback: thử lấy từ profile (id_token)
            const kcProfile = profile as any;
            if (kcProfile?.realm_access?.roles) {
              roles = kcProfile.realm_access.roles;
            }
          }
        } else {
          // Fallback: thử lấy từ profile (id_token)
          const kcProfile = profile as any;
          if (kcProfile?.realm_access?.roles) {
            roles = kcProfile.realm_access.roles;
          }
        }

        return {
          ...token,
          accessToken: account.access_token,
          idToken: account.id_token,       // ← BẮT BUỘC cho federated logout
          refreshToken: account.refresh_token,
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
      // Expose access token cho BFF Proxy (server-side only).
      // Token này KHÔNG bao giờ xuống browser — chỉ BFF API Route đọc qua getServerSession().
      // Bắt buộc để BFF proxy có thể inject Authorization header khi forward request đến backend.
      (session as any).accessToken = token.accessToken as string;
      session.user.roles = (token.roles as string[]) ?? [];

      // Truyền lỗi refresh lên client để hiển thị thông báo (vd: RefreshAccessTokenError)
      if (token.error) {
        (session as any).error = token.error;
      }

      return session;
    },
  },

  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE, // 8 giờ (session tối đa, kể cả refresh)
  },

  // Cookie domain chia sẻ cho cả *.proteus.local để Micro-Frontend gateway
  // (plugins.proteus.local) gọi BFF proxy kèm session cookie (credentials:include).
  // Cùng eTLD+1 nên SameSite=Lax vẫn được gửi — browser JS KHÔNG bao giờ thấy JWT.
  // Localhost dev: giữ host-only (không set domain) để không gãy login.
  // Lưu ý: session cũ (host-only) sẽ hết hiệu lực, user login lại 1 lần.
  cookies: {
    sessionToken: {
      name: sessionCookieName(),
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isSecureCookies(),
        ...(sessionCookieDomain() ? { domain: sessionCookieDomain() } : {}),
      },
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};
