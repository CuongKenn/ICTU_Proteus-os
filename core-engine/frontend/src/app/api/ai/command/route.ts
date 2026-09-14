// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// BFF API Route — POST /api/ai/command
// Nhận lệnh ngôn ngữ tự nhiên từ AIChatWidget → forward tới FastAPI AI Orchestrator.
// BFF inject JWT Token từ HttpOnly Cookie (Browser KHÔNG bao giờ gọi FastAPI trực tiếp).
//
// Luồng xử lý:
//   1. Validate session (Keycloak JWT)
//   2. Forward request tới POST /api/v1/ai/command (FastAPI)
//   3. FastAPI trả về AICommandResponse:
//      - effect=read  → status=completed, result=<kết quả>
//      - effect=write → status=pending_approval, dsl_preview=<DSL JSON>
//
// Tham chiếu:
//   - docs/architecture.md §2.1 (BFF Pattern)
//   - docs/architecture.md §2.3 (AI Orchestrator & DX-DSL)
//   - docs/dsl-spec.md §4 (Effect Levels)
//   - docs/api-swagger.yaml POST /ai/command

import { encode, getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/tokenRefresh";
import {
  SESSION_MAX_AGE,
  isSecureCookies,
  sessionCookieDomain,
  sessionCookieName,
} from "@/lib/sessionCookie";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// Persist JWT đã refresh vào session cookie (copy từ BFF proxy — Keycloak bật
// rotate refresh token nên không persist thì request sau dùng token cũ → chết session).
async function attachRefreshedSession(
  response: NextResponse,
  refreshed: JWT | null
): Promise<NextResponse> {
  if (!refreshed) return response;
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
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Xác thực session — BẮT BUỘC truyền secret để giải mã session cookie (JWE).
  // Thiếu secret getToken() luôn trả null → 401 vĩnh viễn dù session còn sống
  // (đây chính là bug "phiên hết hạn" của Proteus AI trước đây).
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token?.accessToken) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại." },
      { status: 401 }
    );
  }

  // 1b. access_token hết hạn giữa phiên → refresh inline (giống BFF proxy)
  // thay vì trả 401 oan.
  let accessToken = token.accessToken as string;
  let refreshedJwt: JWT | null = null;
  const expires = token.accessTokenExpires as number | undefined;
  if (expires && Date.now() > expires - 10_000) {
    try {
      const refreshed = await refreshAccessToken(token as Parameters<typeof refreshAccessToken>[0]);
      if (refreshed.error) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại." },
          { status: 401 }
        );
      }
      accessToken = refreshed.accessToken as string;
      refreshedJwt = refreshed;
    } catch {
      return NextResponse.json(
        { error: "Unauthorized", message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại." },
        { status: 401 }
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Request body không hợp lệ." },
      { status: 400 }
    );
  }

  // Dùng thẳng dữ liệu từ user gửi qua (natural_language_input, session_id)
  const bodyAny = body as any;
  const backendPayload = {
    session_id: (bodyAny.session_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bodyAny.session_id)) 
                ? bodyAny.session_id 
                : "11111111-1111-1111-1111-111111111111",
    natural_language_input: bodyAny.natural_language_input || ""
  };

  const targetUrl = `${BACKEND_URL}/api/v1/ai/chat`;

  try {
    const backendResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // BFF inject Bearer Token — browser không biết token này
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      body: JSON.stringify(backendPayload),
    // Timeout 120s cho AI inference (vì Llama 3 chạy cục bộ có thể lâu)
      signal: AbortSignal.timeout(120_000),
    });

    const responseText = await backendResponse.text();
    // Bỏ qua eslint vì log cần thiết cho debug
    // eslint-disable-next-line no-console
    console.log(`[BFF] Backend returned status ${backendResponse.status}`);
    // eslint-disable-next-line no-console
    console.log(`[BFF] Backend returned body: ${responseText}`);

    const contentType = backendResponse.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { error: "JSON Parse Error" };
      }
      return attachRefreshedSession(
        NextResponse.json(data, { status: backendResponse.status }),
        refreshedJwt
      );
    }

    // Trường hợp Backend trả non-JSON (unexpected)
    return NextResponse.json(
      { error: "Upstream Error", message: "Backend trả về response không hợp lệ." },
      { status: 502 }
    );
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return NextResponse.json(
        { error: "Gateway Timeout", message: "AI Service mất quá nhiều thời gian phản hồi." },
        { status: 504 }
      );
    }

    // Không thể kết nối tới Backend (network error, Backend down)
    return NextResponse.json(
      { error: "Service Unavailable", message: "Không thể kết nối tới AI Service." },
      { status: 503 }
    );
  }
}

// Chỉ cho phép POST — method khác trả 405
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}
