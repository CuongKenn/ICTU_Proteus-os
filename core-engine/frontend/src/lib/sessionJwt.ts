// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Session JWT helpers — đọc/ghi lại session cookie của NextAuth.
//
// LÝ DO TỒN TẠI: Keycloak realm bật revokeRefreshToken=true + maxReuse=0 nên
// refresh_token là single-use (xoay mỗi lần). Khi BFF proxy tự refresh (inline),
// nó PHẢI ghi refresh_token mới trở lại cookie, nếu không lần sau dùng lại token
// cũ → Keycloak trả "Maximum allowed refresh token reuse exceeded" → user bị đá
// về /login dù refresh_token còn hạn.
//
// QUAN TRỌNG (chunking): JWT session chứa access_token + id_token + refresh_token
// nên dài ~4-5KB, VƯỢT giới hạn 4KB/cookie của browser. NextAuth tự tách thành
// nhiều cookie `...session-token.0`, `.1` (CHUNK_SIZE = 4096 - 163). Nếu BFF ghi
// 1 cookie đơn > 4096 bytes thì browser âm thầm bỏ qua → refresh_token xoay không
// được lưu → reuse token cũ → logout. Vì vậy hàm ghi dưới đây phải chunk y hệt
// NextAuth và xoá các chunk cũ không còn dùng.

import { encode, getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import type { NextRequest, NextResponse } from "next/server";

import { refreshAccessToken } from "@/lib/tokenRefresh";
import { SESSION_MAX_AGE, isSecureCookies, sessionCookieName } from "@/lib/sessionCookie";

const SECRET = process.env.NEXTAUTH_SECRET;

// Khớp hằng số nội bộ của next-auth/core/lib/cookie.js
const ALLOWED_COOKIE_SIZE = 4096;
const ESTIMATED_EMPTY_COOKIE_SIZE = 163;
const CHUNK_SIZE = ALLOWED_COOKIE_SIZE - ESTIMATED_EMPTY_COOKIE_SIZE;

// Refresh sớm trước khi access_token thực sự hết hạn để tránh race ở edge.
const EXPIRY_SKEW_MS = 30_000;

/** Đọc session JWT từ cookie (dùng chung secret + tên cookie với NextAuth). */
export async function readSessionToken(req: NextRequest): Promise<JWT | null> {
  return getToken({ req, secret: SECRET, cookieName: sessionCookieName() });
}

/**
 * Ghi lại session JWT mới vào response cookie, tách chunk như NextAuth.
 *
 * @param req request gốc — cần để biết các chunk cũ hòng xoá khi số chunk đổi
 *            (vd trước 2 chunk, sau 1 chunk). Thiếu `req` có thể để lại chunk cũ
 *            khiến SessionStore ghép cookie cũ + mới → token hỏng.
 */
export async function writeSessionToken(
  res: NextResponse,
  token: JWT,
  req?: NextRequest
): Promise<void> {
  const encoded = await encode({ token, secret: SECRET!, maxAge: SESSION_MAX_AGE });
  const name = sessionCookieName();
  const baseOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: isSecureCookies(),
  };
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  const chunkCount = Math.max(1, Math.ceil(encoded.length / CHUNK_SIZE));
  const chunks = new Map<string, string>();
  if (chunkCount === 1) {
    chunks.set(name, encoded);
  } else {
    for (let i = 0; i < chunkCount; i++) {
      chunks.set(
        `${name}.${i}`,
        encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      );
    }
  }

  // Xoá các chunk cũ không còn nằm trong bộ mới (đổi số lượng chunk).
  if (req) {
    for (const { name: existing } of req.cookies.getAll()) {
      if (existing.startsWith(name) && !chunks.has(existing)) {
        res.cookies.set(existing, "", {
          ...baseOptions,
          maxAge: 0,
          expires: new Date(0),
        });
      }
    }
  }

  for (const [cookieName, value] of Array.from(chunks.entries())) {
    res.cookies.set(cookieName, value, {
      ...baseOptions,
      maxAge: SESSION_MAX_AGE,
      expires,
    });
  }
}

/**
 * Lấy access_token còn hiệu lực từ session cookie, tự refresh inline nếu sắp/hết
 * hạn. Trả về `refreshedJwt` (nếu có refresh) để route gọi `writeSessionToken`
 * persist refresh_token xoay vào cookie — bắt buộc với Keycloak single-use RT.
 */
export async function resolveAccessToken(req: NextRequest): Promise<{
  accessToken: string | null;
  refreshedJwt: JWT | null;
}> {
  const token = await readSessionToken(req);
  if (!token?.accessToken) {
    return { accessToken: null, refreshedJwt: null };
  }

  const expires = token.accessTokenExpires as number | undefined;
  if (expires && Date.now() < expires - EXPIRY_SKEW_MS) {
    return { accessToken: token.accessToken as string, refreshedJwt: null };
  }

  const refreshed = await refreshAccessToken(token);
  if (refreshed.error || !refreshed.accessToken) {
    return { accessToken: null, refreshedJwt: null };
  }
  return { accessToken: refreshed.accessToken as string, refreshedJwt: refreshed };
}
