// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// BFF API Route — Backend Proxy
// Tất cả request từ Client → BFF Proxy → FastAPI Backend.
// Token được inject và tự động refresh. Browser KHÔNG bao giờ gọi Backend trực tiếp.
// Dùng getToken() + manual refresh thay vì getServerSession() (gây 500 trong App Router).
// Tham chiếu: docs/architecture.md (BFF Pattern)

import { getToken } from "next-auth/jwt";
import { encode } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/tokenRefresh";
import {
  SESSION_MAX_AGE,
  isSecureCookies,
  sessionCookieDomain,
  sessionCookieName,
} from "@/lib/sessionCookie";
import { logger } from "@/lib/logger";


const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// ─── CORS cho Micro-Frontend gateway (plugins.<parent-domain>) ──
// MFE chạy origin khác (plugins.proteus.local) nhưng cùng site nên được gửi
// session cookie (SameSite=Lax) khi fetch với credentials:"include".
// Chỉ allow origin plugins.* cùng parent domain với host đang serve.
function mfeCorsHeaders(request: NextRequest): Record<string, string> | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return null;
  }
  // Chạy sau Traefik nên Host mà Next thấy là container ID —
  // phải đọc host gốc từ X-Forwarded-Host do Traefik gắn.
  const rawHost =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    request.nextUrl.hostname;
  const hostParts = rawHost.split(".");
  const parentDomain =
    hostParts.length >= 2 ? hostParts.slice(-2).join(".") : request.nextUrl.hostname;
  const allowed = new Set([
    `http://plugins.${parentDomain}`,
    `https://plugins.${parentDomain}`,
  ]);
  if (!allowed.has(originUrl.origin)) return null;
  return {
    "Access-Control-Allow-Origin": originUrl.origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept,Authorization",
    Vary: "Origin",
  };
}

function withCors(response: NextResponse, cors: Record<string, string> | null) {
  if (cors) {
    for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
  }
  return response;
}

// Ghi JWT đã refresh trở lại session cookie. BẮT BUỘC vì Keycloak bật
// rotate refresh token (revokeRefreshToken): không persist thì request sau
// dùng lại refresh token cũ → invalid_grant → session chết sau ~5 phút.
async function attachRefreshedSession(
  response: NextResponse,
  refreshed: JWT | null
): Promise<NextResponse> {
  if (!refreshed) return response;
  try {
    const sealed = await encode({
      token: refreshed,
      secret: process.env.NEXTAUTH_SECRET ?? "",
      maxAge: SESSION_MAX_AGE,
    });
    response.cookies.set(sessionCookieName(), sealed, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isSecureCookies(),
      maxAge: SESSION_MAX_AGE,
      ...(sessionCookieDomain() ? { domain: sessionCookieDomain() } : {}),
    });
  } catch (err) {
    logger.error("[BFF] Không persist được session sau refresh:", err);
  }
  return response;
}

async function proxyHandler(
  request: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  const cors = mfeCorsHeaders(request);

  // Preflight từ MFE (không kèm cookie) — trả 204 ngay, chưa cần auth.
  if (request.method === "OPTIONS") {
    return withCors(new NextResponse(null, { status: 204 }), cors);
  }

  // getToken() đọc JWT từ session cookie — nhẹ hơn getServerSession() và không gây 500.
  // Nếu access_token hết hạn, tự refresh bằng refreshAccessToken() trước khi forward.
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    logger.error("[BFF] Proxy 401: no session token found");
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      cors
    );
  }

  // Kiểm tra token hết hạn — thử refresh inline thay vì trả 401 ngay.
  // Nếu refresh thành công, refreshedJwt được persist vào cookie ở response
  // cuối (xem attachRefreshedSession) để request sau không reuse token cũ.
  let accessToken = token.accessToken as string;
  let refreshedJwt: JWT | null = null;
  const expires = token.accessTokenExpires as number | undefined;
  if (expires && Date.now() > expires - 10_000) {
    logger.info("[BFF] access_token sắp/đã hết hạn — thử refresh inline");
    try {
      const refreshed = await refreshAccessToken(token as Parameters<typeof refreshAccessToken>[0]);
      if (refreshed.error) {
        logger.error("[BFF] Refresh token thất bại:", refreshed.error);
        return NextResponse.json({ error: "AccessTokenExpired" }, { status: 401 });
      }
      accessToken = refreshed.accessToken as string;
      refreshedJwt = refreshed;
      logger.info("[BFF] Refresh token thành công — tiếp tục proxy với token mới");
    } catch (err) {
      logger.error("[BFF] Lỗi khi refresh token:", err);
      return NextResponse.json({ error: "AccessTokenExpired" }, { status: 401 });
    }
  }

  if (!accessToken) {
    logger.error("[BFF] Proxy 401: accessToken null");
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      cors
    );
  }

  const targetPath = params.path.join("/");
  // Frontend calls api.get("/v1/roles") → params.path = ["v1","roles"] → targetPath = "v1/roles"
  // Dùng /api/ (không thêm v1) để tránh double prefix: /api/v1/v1/roles (404)
  const targetUrl = `${BACKEND_URL}/api/${targetPath}${request.nextUrl.search}`;

  // Forward headers có chọn lọc — không forward cookie, host, x-forwarded-* từ client
  const headers = new Headers({
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": request.headers.get("Content-Type") ?? "application/json",
    Accept: request.headers.get("Accept") ?? "application/json",
    "X-Forwarded-For": request.headers.get("x-forwarded-for") ?? "",
  });

  // Đọc body một lần — request.text() không thể gọi 2 lần
  let body: string | undefined = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.text();
    } catch (error) {
      logger.error("[BFF] Lỗi đọc request body:", error);
      return NextResponse.json(
        { error: "Invalid request body format or stream interrupted" },
        { status: 400 }
      );
    }
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });
  } catch (err: any) {
    logger.error(`[BFF] Fetch to backend failed: ${err.message}`);
    return withCors(
      NextResponse.json({ error: "Backend unavailable" }, { status: 502 }),
      cors
    );
  }

  logger.info(`[BFF] ${request.method} ${targetUrl} → ${response.status}`);

  if (response.status === 401) {
    const txt = await response.text();
    logger.error(`[BFF] Backend returned 401 for ${targetUrl}: ${txt}`);
    return withCors(
      NextResponse.json(
        { error: "Unauthorized from backend", detail: txt },
        { status: 401 }
      ),
      cors
    );
  }

  // Proxy status code và response body nguyên vẹn
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => null);
    return attachRefreshedSession(
      withCors(NextResponse.json(data, { status: response.status }), cors),
      refreshedJwt
    );
  }

  // Non-JSON response (ví dụ: file download)
  const blob = await response.blob();
  return attachRefreshedSession(
    withCors(
      new NextResponse(blob, {
        status: response.status,
        headers: { "Content-Type": contentType },
      }),
      cors
    ),
    refreshedJwt
  );
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
export const OPTIONS = proxyHandler;
