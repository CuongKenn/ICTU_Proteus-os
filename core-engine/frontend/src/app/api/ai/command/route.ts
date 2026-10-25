// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// BFF API Route — POST /api/ai/command
// Nhận lệnh ngôn ngữ tự nhiên từ AIChatWidget → forward tới FastAPI AI Chat
// (endpoint `/api/v1/ai/chat` nhận AIChatRequest — KHÔNG phải `/ai/command`
// vốn chỉ nhận DX-DSL đầy đủ action/effect).
// BFF inject JWT Token từ HttpOnly Cookie (Browser KHÔNG bao giờ gọi FastAPI trực tiếp).
//
// Luồng xử lý:
//   1. Validate session (Keycloak JWT)
//   2. Forward request tới POST /api/v1/ai/chat (FastAPI AIChatUseCase)
//   3. Chuẩn hóa response về contract của useAICommand:
//      - status: completed | pending_approval | error
//      - result: text hiển thị (backend để text đọc được ở `message`,
//        còn `result` là dict kỹ thuật)
//      - dsl_preview: giữ nguyên khi chờ duyệt
//
// Tham chiếu:
//   - docs/architecture.md §2.1 (BFF Pattern)
//   - docs/architecture.md §2.3 (AI Orchestrator & DX-DSL)
//   - docs/dsl-spec.md §4 (Effect Levels)
//   - docs/api-swagger.yaml POST /ai/command

import { NextRequest, NextResponse } from "next/server";
import { resolveAccessToken, writeSessionToken } from "@/lib/sessionJwt";
import { logger } from "@/lib/logger";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Xác thực session — Token được đọc từ HttpOnly Cookie phía server.
  //    Nếu access_token sắp/hết hạn thì refresh inline + persist cookie mới.
  const { accessToken, refreshedJwt } = await resolveAccessToken(request);

  if (!accessToken) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại." },
      { status: 401 }
    );
  }

  // Gắn session cookie mới (nếu vừa refresh) vào MỌI response để không mất
  // refresh_token xoay (Keycloak single-use).
  const json = async (body: unknown, init?: ResponseInit): Promise<NextResponse> => {
    const res = NextResponse.json(body, init);
    if (refreshedJwt) {
      try {
        await writeSessionToken(res, refreshedJwt, request);
      } catch (err) {
        logger.error("[BFF/AI] Không ghi được session cookie sau refresh:", err);
      }
    }
    return res;
  };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      { error: "Bad Request", message: "Request body không hợp lệ." },
      { status: 400 }
    );
  }

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
      body: JSON.stringify(body),
      // Timeout 180s cho AI inference (1 turn = plan + ReAct + tổng hợp RAG,
      // model local tốn 60-90s). Đồng bộ với /api/ai/chat/stream.
      signal: AbortSignal.timeout(180_000),
    });

    const contentType = backendResponse.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = await backendResponse.json();
      return json(normalizeAIResponse(data), {
        status: backendResponse.status,
      });
    }

    // Trường hợp Backend trả non-JSON (unexpected)
    return json(
      { error: "Upstream Error", message: "Backend trả về response không hợp lệ." },
      { status: 502 }
    );
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return json(
        { error: "Gateway Timeout", message: "AI Service mất quá nhiều thời gian phản hồi." },
        { status: 504 }
      );
    }

    // Không thể kết nối tới Backend (network error, Backend down)
    return json(
      { error: "Service Unavailable", message: "Không thể kết nối tới AI Service." },
      { status: 503 }
    );
  }
}

// Chỉ cho phép POST — method khác trả 405
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}

/**
 * Chuẩn hóa AICommandResponse của backend về contract của useAICommand.
 * Backend dùng status UPPER_SNAKE (COMPLETED/PENDING_APPROVAL/FAILED),
 * text đọc được nằm ở `message`, còn `result` là dict kỹ thuật {steps,...}.
 */
function normalizeAIResponse(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const raw = data as Record<string, unknown>;

  const rawStatus = typeof raw.status === "string" ? raw.status : "";
  const status =
    rawStatus === "COMPLETED"
      ? "completed"
      : rawStatus === "PENDING_APPROVAL"
        ? "pending_approval"
        : "error";

  const message = typeof raw.message === "string" ? raw.message : "";
  // Chat hiển thị `result`: ưu tiên string có sẵn, else dùng message đọc được.
  const result =
    typeof raw.result === "string" && raw.result.trim().length > 0
      ? raw.result
      : message;

  // Chi tiết steps/thoughts cho UI ẩn sau click (không nhét vào message).
  let details: {
    steps: Array<{ action: string; status: string; message: string }>;
    thoughts: string[];
  } | null = null;
  if (raw.result && typeof raw.result === "object" && !Array.isArray(raw.result)) {
    const r = raw.result as Record<string, unknown>;
    const steps = Array.isArray(r.steps)
      ? r.steps
          .filter((s) => s && typeof s === "object")
          .map((s) => {
            const o = s as Record<string, unknown>;
            return {
              action: typeof o.action === "string" ? o.action : "",
              status: typeof o.status === "string" ? o.status : "",
              message: typeof o.message === "string" ? o.message : "",
            };
          })
      : [];
    const thoughts = Array.isArray(r.thoughts)
      ? r.thoughts.filter((t): t is string => typeof t === "string")
      : [];
    if (steps.length > 0 || thoughts.length > 0) {
      details = { steps, thoughts };
    }
  }

  return { ...raw, status, message, result, details };
}
