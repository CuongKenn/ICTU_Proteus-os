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

import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Xác thực session — Token được đọc từ HttpOnly Cookie phía server
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại." },
      { status: 401 }
    );
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

  const targetUrl = `${BACKEND_URL}/api/v1/ai/execute`;

  try {
    const backendResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // BFF inject Bearer Token — browser không biết token này
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      // Timeout 30s cho AI inference
      signal: AbortSignal.timeout(30_000),
    });

    const contentType = backendResponse.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = await backendResponse.json();
      return NextResponse.json(data, { status: backendResponse.status });
    }

    // Trường hợp Backend trả non-JSON (unexpected)
    return NextResponse.json(
      { error: "Upstream Error", message: "Backend trả về response không hợp lệ." },
      { status: 502 }
    );
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
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
