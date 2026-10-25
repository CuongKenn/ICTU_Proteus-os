// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// BFF API Route — Backend Proxy
// Tất cả request từ Client → BFF Proxy → FastAPI Backend.
// Token được inject và tự động refresh. Browser KHÔNG bao giờ gọi Backend trực tiếp.
// Dùng getToken() + manual refresh thay vì getServerSession() (gây 500 trong App Router).
// Tham chiếu: docs/architecture.md (BFF Pattern)

import { NextRequest, NextResponse } from "next/server";
import { resolveAccessToken, writeSessionToken } from "@/lib/sessionJwt";
import { logger } from "@/lib/logger";


const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

async function proxyHandler(
  request: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  // Đọc session JWT từ cookie; nếu access_token sắp/hết hạn thì refresh inline
  // và persist refresh_token xoay vào cookie (bắt buộc với Keycloak single-use RT).
  const { accessToken, refreshedJwt } = await resolveAccessToken(request);

  if (!accessToken) {
    logger.error("[BFF] Proxy 401: không có session/refresh thất bại");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetPath = params.path.join("/");
  // Frontend calls api.get("/v1/roles") → params.path = ["v1","roles"] → targetPath = "v1/roles"
  // Dùng /api/ (không thêm v1) để tránh double prefix: /api/v1/v1/roles (404)
  const targetUrl = `${BACKEND_URL}/api/${targetPath}${request.nextUrl.search}`;

  // Forward headers có chọn lọc — không forward cookie từ client.
  // GIỮ X-Forwarded-Host/Proto để backend dựng đúng link công khai (vd email mời
  // nhân viên trỏ về https://<domain>/login thay vì localhost/container host).
  const headers = new Headers({
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": request.headers.get("Content-Type") ?? "application/json",
    Accept: request.headers.get("Accept") ?? "application/json",
    "X-Forwarded-For": request.headers.get("x-forwarded-for") ?? "",
    "X-Forwarded-Host":
      request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "",
    "X-Forwarded-Proto":
      request.headers.get("x-forwarded-proto") ??
      request.nextUrl.protocol.replace(":", ""),
  });

  // Đọc body một lần — request.text() không thể gọi 2 lần.
  // Multipart (upload file) phải đọc dạng binary — đọc text sẽ làm hỏng file.
  let body: string | ArrayBuffer | undefined = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      const reqContentType = request.headers.get("Content-Type") ?? "";
      body = reqContentType.includes("multipart/form-data")
        ? await request.arrayBuffer()
        : await request.text();
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

  logger.info(`[BFF] ${request.method} ${targetUrl} → ${response.status}`);

  // Helper: gắn session cookie mới (nếu vừa refresh) vào MỌI response.
  // Đây là điểm mấu chốt để giữ phiên — refresh_token xoay phải được lưu lại.
  const withRefreshedCookie = async (out: NextResponse): Promise<NextResponse> => {
    if (refreshedJwt) {
      try {
        await writeSessionToken(out, refreshedJwt, request);
      } catch (err) {
        logger.error("[BFF] Không ghi được session cookie sau refresh:", err);
      }
    }
    return out;
  };

  if (response.status === 401) {
    const txt = await response.text();
    logger.error(`[BFF] Backend returned 401 for ${targetUrl}: ${txt}`);
    return withRefreshedCookie(
      NextResponse.json(
        { error: "Unauthorized from backend", detail: txt },
        { status: 401 }
      )
    );
  }

  // Proxy status code và response body nguyên vẹn
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => null);
    return withRefreshedCookie(
      NextResponse.json(data, { status: response.status })
    );
  }

  // Non-JSON response (ví dụ: file download)
  const blob = await response.blob();
  return withRefreshedCookie(
    new NextResponse(blob, {
      status: response.status,
      headers: { "Content-Type": contentType },
    })
  );
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
