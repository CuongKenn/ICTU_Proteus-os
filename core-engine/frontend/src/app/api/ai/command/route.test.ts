// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

import { getToken } from "next-auth/jwt";

describe("AI Command BFF Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session has no accessToken", async () => {
    vi.mocked(getToken).mockResolvedValue(null);
    const req = new NextRequest("http://localhost:3000/api/ai/command", {
      method: "POST",
      body: JSON.stringify({ natural_language_input: "test" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("routes natural_language_input to /api/v1/ai/chat and normalizes status", async () => {
    vi.mocked(getToken).mockResolvedValue({
      accessToken: "mocked-token",
    } as any);

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          command_id: "c-123",
          status: "PENDING_APPROVAL",
          message: "Wait for approval",
          result: {
            action: "hr.leave.approve",
            effect: "write",
          },
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    global.fetch = mockFetch;

    const req = new NextRequest("http://localhost:3000/api/ai/command", {
      method: "POST",
      body: JSON.stringify({
        session_id: "7d793037-a076-4c06-8fde-1b9b7b16e01b",
        natural_language_input: "Duyệt đơn nghỉ phép của Nam",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(202);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/ai/chat",
      expect.objectContaining({
        method: "POST",
      })
    );

    const data = await res.json();
    // Verify status was normalized to lowercase and dsl_preview populated
    expect(data.status).toBe("pending_approval");
    expect(data.dsl_preview).toBeDefined();
    expect(data.dsl_preview.action).toBe("hr.leave.approve");
  });

  it("routes DX-DSL action command to /api/v1/ai/command", async () => {
    vi.mocked(getToken).mockResolvedValue({
      accessToken: "mocked-token",
    } as any);

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          command_id: "cmd-456",
          status: "COMPLETED",
          message: "Success",
          result: "Done",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    global.fetch = mockFetch;

    const req = new NextRequest("http://localhost:3000/api/ai/command", {
      method: "POST",
      body: JSON.stringify({
        session_id: "7d793037-a076-4c06-8fde-1b9b7b16e01b",
        action: "hr.leave.list",
        effect: "read",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/ai/command",
      expect.objectContaining({
        method: "POST",
      })
    );

    const data = await res.json();
    expect(data.status).toBe("completed");
    expect(data.result).toBe("Done");
  });
});
