// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// BFF API Route — Backend Proxy
// Tất cả request từ Client → BFF Proxy → FastAPI Backend.
// Token được inject tự động. Browser KHÔNG bao giờ gọi Backend trực tiếp.
// Tham chiếu: docs/architecture.md (BFF Pattern)

import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

async function proxyHandler(
  request: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (request.nextUrl.pathname.endsWith('/debug-token')) {
    return NextResponse.json({ token, hasToken: !!token });
  }

  if (!token?.accessToken) {
    logger.error("[BFF] Proxy 401: token missing or accessToken null", { hasToken: !!token });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetPath = params.path.join("/");
  const targetUrl = `${BACKEND_URL}/api/v1/${targetPath}${request.nextUrl.search}`;

  // Forward headers có chọn lọc — không forward cookie, host, x-forwarded-* từ client
  const headers = new Headers({
    Authorization: `Bearer ${token.accessToken}`,
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
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }

  logger.info(`[BFF] Proxy to ${targetUrl} returned ${response.status}`);

  if (response.status === 401) {
    const txt = await response.text();
    logger.error(`[BFF] Backend returned 401 for ${targetUrl}: ${txt}`);
    return NextResponse.json({ error: "Unauthorized from backend", detail: txt }, { status: 401 });
  }

  // Proxy status code và response body nguyên vẹn
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => null);
    return NextResponse.json(data, { status: response.status });
  }

  // Non-JSON response (ví dụ: file download)
  const blob = await response.blob();
  return new NextResponse(blob, {
    status: response.status,
    headers: { "Content-Type": contentType },
  });
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
