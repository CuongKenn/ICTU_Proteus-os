// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
  encode: vi.fn().mockResolvedValue("mocked-encoded-session-token"),
}));

vi.mock("@/lib/tokenRefresh", () => ({
  refreshAccessToken: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getToken, encode } from "next-auth/jwt";
import { refreshAccessToken } from "@/lib/tokenRefresh";

describe("BFF Proxy Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no token is present", async () => {
    vi.mocked(getToken).mockResolvedValue(null);
    const req = new NextRequest("http://localhost:3000/api/proxy/v1/plugins");
    const res = await GET(req, { params: { path: ["v1", "plugins"] } });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("forwards request directly when token is valid and not expiring", async () => {
    vi.mocked(getToken).mockResolvedValue({
      accessToken: "valid-token",
      accessTokenExpires: Date.now() + 100_000,
    } as any);

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    global.fetch = mockFetch;

    const req = new NextRequest("http://localhost:3000/api/proxy/v1/plugins");
    const res = await GET(req, { params: { path: ["v1", "plugins"] } });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/plugins",
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
    // No rotated cookie set
    expect(res.cookies.get("next-auth.session-token")).toBeUndefined();
  });

  it("refreshes token and persists new session cookie when token is expiring", async () => {
    vi.mocked(getToken).mockResolvedValue({
      sub: "user-123",
      accessToken: "old-token",
      refreshToken: "old-refresh-token",
      accessTokenExpires: Date.now() + 2_000, // Near expiry (within 10s)
    } as any);

    vi.mocked(refreshAccessToken).mockResolvedValue({
      sub: "user-123",
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      accessTokenExpires: Date.now() + 60_000,
    } as any);

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: "refreshed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    global.fetch = mockFetch;

    const req = new NextRequest("http://localhost:3000/api/proxy/v1/plugins");
    const res = await GET(req, { params: { path: ["v1", "plugins"] } });

    expect(res.status).toBe(200);
    expect(refreshAccessToken).toHaveBeenCalled();
    expect(encode).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.objectContaining({
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
        }),
      })
    );

    // Verify Set-Cookie header contains rotated session token
    const cookie = res.cookies.get("next-auth.session-token");
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe("mocked-encoded-session-token");
  });

  it("returns 401 when refresh fails with error", async () => {
    vi.mocked(getToken).mockResolvedValue({
      sub: "user-123",
      accessToken: "old-token",
      refreshToken: "revoked-refresh-token",
      accessTokenExpires: Date.now() - 5_000,
    } as any);

    vi.mocked(refreshAccessToken).mockResolvedValue({
      error: "RefreshAccessTokenError",
    } as any);

    const req = new NextRequest("http://localhost:3000/api/proxy/v1/plugins");
    const res = await GET(req, { params: { path: ["v1", "plugins"] } });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("AccessTokenExpired");
  });
});
