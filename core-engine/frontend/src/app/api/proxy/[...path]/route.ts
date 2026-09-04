// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// BFF API Route — Backend Proxy
// Tất cả request từ Client → BFF Proxy → FastAPI Backend.
// Token được inject tự động. Browser KHÔNG bao giờ gọi Backend trực tiếp.
// Tham chiếu: docs/architecture.md (BFF Pattern)

import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// Dùng cookies() từ next/headers — cách chuẩn của Next.js 14 App Router
// NextAuth tự động split JWT lớn (>4KB) thành nhiều cookies: .0, .1, .2 ...
// Phải ghép lại trước khi decode.
async function getJWTToken() {
  const cookieStore = cookies();
  const isSecure = process.env.NEXTAUTH_URL?.startsWith("https://");
  const baseName = isSecure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  try {
    // Thử đọc cookie đơn trước
    const singleCookie = cookieStore.get(baseName)?.value;
    if (singleCookie) {
      return await decode({ token: singleCookie, secret: process.env.NEXTAUTH_SECRET! });
    }

    // JWT bị chunk: ghép next-auth.session-token.0 + .1 + .2 + ...
    const chunks: string[] = [];
    for (let i = 0; i < 10; i++) {
      const chunk = cookieStore.get(`${baseName}.${i}`)?.value;
      if (!chunk) break;
      chunks.push(chunk);
    }

    if (chunks.length === 0) {
      logger.error("[BFF] No session token cookies found. Available:", cookieStore.getAll().map((c) => c.name));
      return null;
    }

    const fullToken = chunks.join("");
    return await decode({ token: fullToken, secret: process.env.NEXTAUTH_SECRET! });
  } catch (e) {
    logger.error("[BFF] Failed to decode session token:", e);
    return null;
  }
}


async function proxyHandler(
  request: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  // Dùng getJWTToken() không cần request — cookies() từ next/headers tự đọc
  const token = await getJWTToken();

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

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

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
