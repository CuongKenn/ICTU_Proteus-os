// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// BFF API Route — Backend Proxy
// Tất cả request từ Client → BFF Proxy → FastAPI Backend.
// Token được inject tự động. Browser KHÔNG bao giờ gọi Backend trực tiếp.
// Tham chiếu: docs/architecture.md (BFF Pattern)

import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

async function proxyHandler(
  request: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetPath = params.path.join("/");
  const targetUrl = `${BACKEND_URL}/api/v1/${targetPath}${request.nextUrl.search}`;

  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  headers.delete("cookie"); // Không forward cookie xuống Backend

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : undefined,
  });

  const data = await response.json().catch(() => null);
  return NextResponse.json(data, { status: response.status });
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
