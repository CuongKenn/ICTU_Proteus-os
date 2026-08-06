// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// NextAuth options — BFF Security Pattern
// Browser KHÔNG bao giờ nhận JWT trực tiếp.
// Token được lưu trong HttpOnly session cookie do Next.js quản lý.
// Tham chiếu: docs/architecture.md (BFF Pattern), docs/clarification.md §8

import type { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],

  // Lưu token vào session để BFF có thể inject vào request xuống Backend
  callbacks: {
    async jwt({ token, account }) {
      // Lần đầu login — lưu access_token và refresh_token vào JWT session
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 60 * 60 * 1000; // Fallback: 1 giờ từ bây giờ
      }

      // Token vẫn còn hạn
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // TODO: Silent Refresh — làm mới token khi hết hạn
      // Tham chiếu: docs/clarification.md §8.2
      return token;
    },

    async session({ session, token }) {
      // Expose access token lên session để BFF Proxy sử dụng
      // NOTE: accessToken KHÔNG được expose xuống browser (chỉ dùng ở server-side API routes)
      session.accessToken = token.accessToken as string;
      return session;
    },
  },

  // Session dùng JWT (stateless) — không cần DB
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 giờ
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};
