// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// BFF API Route — POST /api/ai/chat/stream
// Pipe SSE từ FastAPI POST /api/v1/ai/chat/stream về browser.
// Auth + refresh inline giống /api/ai/command (token không bao giờ xuống browser).

import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { refreshAccessToken } from "@/lib/tokenRefresh";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest): Promise<Response> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token?.accessToken) {
    return Response.json(
      { error: "Unauthorized", message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại." },
      { status: 401 }
    );
  }

  let accessToken = token.accessToken as string;
  const expires = token.accessTokenExpires as number | undefined;
  if (expires && Date.now() > expires - 10_000) {
    try {
      const refreshed = await refreshAccessToken(token as Parameters<typeof refreshAccessToken>[0]);
      if (refreshed.error) {
        return Response.json(
          { error: "Unauthorized", message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại." },
          { status: 401 }
        );
      }
      accessToken = refreshed.accessToken as string;
    } catch {
      return Response.json(
        { error: "Unauthorized", message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại." },
        { status: 401 }
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
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
      return Response.json(
        { error: "Gateway Timeout", message: "AI Service mất quá nhiều thời gian phản hồi." },
        { status: 504 }
      );
    }
    return Response.json(
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
    return Response.json(
      { error: "Upstream Error", message: text || "Backend trả về response không hợp lệ." },
      { status: upstream.status || 502 }
    );
  }

  // Pipe nguyên stream SSE về browser (không buffer).
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET(): Promise<Response> {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}
