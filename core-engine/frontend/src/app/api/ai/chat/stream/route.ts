// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// BFF API Route — POST /api/ai/chat/stream
// Pipe SSE từ FastAPI POST /api/v1/ai/chat/stream về browser.
// Auth + refresh inline giống /api/ai/command (token không bao giờ xuống browser).
//
// LƯU Ý: nếu refresh inline thì PHẢI persist session cookie mới vào response,
// nếu không refresh_token xoay (Keycloak single-use) bị mất → logout.

import { NextRequest, NextResponse } from "next/server";
import { resolveAccessToken, writeSessionToken } from "@/lib/sessionJwt";
import { logger } from "@/lib/logger";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest): Promise<Response> {
  const { accessToken, refreshedJwt } = await resolveAccessToken(request);

  if (!accessToken) {
    return Response.json(
      { error: "Unauthorized", message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại." },
      { status: 401 }
    );
  }

  // Gắn session cookie mới (nếu vừa refresh) vào MỌI response.
  const withRefreshedCookie = async (res: NextResponse): Promise<NextResponse> => {
    if (refreshedJwt) {
      try {
        await writeSessionToken(res, refreshedJwt, request);
      } catch (err) {
        logger.error("[BFF/AI] Không ghi được session cookie sau refresh:", err);
      }
    }
    return res;
  };
  const json = (body: unknown, init?: ResponseInit) =>
    withRefreshedCookie(NextResponse.json(body, init));

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      { error: "Bad Request", message: "Request body không hợp lệ." },
      { status: 400 }
    );
  }

  const bodyAny = body as any;
  const backendPayload = {
    session_id: (bodyAny.session_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bodyAny.session_id))
                ? bodyAny.session_id
                : "11111111-1111-1111-1111-111111111111",
    natural_language_input: bodyAny.natural_language_input || ""
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/api/v1/ai/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(backendPayload),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return json(
        { error: "Gateway Timeout", message: "AI Service mất quá nhiều thời gian phản hồi." },
        { status: 504 }
      );
    }
    return json(
      { error: "Service Unavailable", message: "Không thể kết nối tới AI Service." },
      { status: 503 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    let text = "";
    try {
      text = await upstream.text();
    } catch {
      text = "";
    }
    return json(
      { error: "Upstream Error", message: text || "Backend trả về response không hợp lệ." },
      { status: upstream.status || 502 }
    );
  }

  // Pipe nguyên stream SSE về browser (không buffer).
  return withRefreshedCookie(
    new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  );
}

export async function GET(): Promise<Response> {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}
