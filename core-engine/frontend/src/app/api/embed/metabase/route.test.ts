// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { GET } from "./route";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

import { getToken } from "next-auth/jwt";
import { logger } from "@/lib/logger";

// Mock logger.warn to suppress expected warnings during tests
const originalWarn = logger.warn;
beforeEach(() => {
  logger.warn = vi.fn();
});
afterEach(() => {
  logger.warn = originalWarn;
});

// Helper to create a fake Keycloak JWT token with tenant_id
const createFakeJwt = (payload: any) => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const signature = "signature";
  return `${header}.${body}.${signature}`;
};

describe("GET /api/embed/metabase", () => {
  const mockFetch = vi.fn();
  
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = mockFetch;
    vi.stubEnv("NODE_ENV", "development"); // Ensure we can hit the mock fallback
  });

  it("should return 401 if user is not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(getToken).mockResolvedValue(null);
    
    const request = new NextRequest("http://localhost:3000/api/embed/metabase?dashboard_id=1");
    const response = await GET(request);
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 if dashboard_id is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      accessToken: createFakeJwt({ tenant_id: "tenant-1" }),
      expires: "12345",
    });
    vi.mocked(getToken).mockResolvedValue({
      accessToken: createFakeJwt({ tenant_id: "tenant-1" }),
    } as any);
    
    const request = new NextRequest("http://localhost:3000/api/embed/metabase");
    const response = await GET(request);
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Thiếu tham số dashboard_id");
  });

  it("should return data from backend if fetch is successful", async () => {
    const fakeToken = createFakeJwt({ tenant_id: "tenant-1" });
    vi.mocked(getServerSession).mockResolvedValue({
      accessToken: fakeToken,
      expires: "12345",
    });
    vi.mocked(getToken).mockResolvedValue({
      accessToken: fakeToken,
    } as any);
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "http://backend-metabase-url" }),
    });
    
    const request = new NextRequest("http://localhost:3000/api/embed/metabase?dashboard_id=1");
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.url).toBe("http://backend-metabase-url");
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/embed/metabase/1"),
      expect.objectContaining({
        headers: {
          Authorization: `Bearer ${fakeToken}`,
          "Content-Type": "application/json",
        },
      })
    );
  });

  it("should return mock URL if backend fetch fails (development mode)", async () => {
    const fakeToken = createFakeJwt({ tenant_id: "tenant-1" });
    vi.mocked(getServerSession).mockResolvedValue({
      accessToken: fakeToken,
      expires: "12345",
    });
    vi.mocked(getToken).mockResolvedValue({
      accessToken: fakeToken,
    } as any);
    
    // Simulate backend failure
    mockFetch.mockRejectedValueOnce(new Error("Network Error"));
    
    const request = new NextRequest("http://localhost:3000/api/embed/metabase?dashboard_id=1");
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.url).toContain("embed/dashboard/");
    const base64Token = data.url.split("embed/dashboard/")[1].split("#")[0];
    expect(Buffer.from(base64Token, "base64").toString()).toContain("mock_token");
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("MOCK Signed URL"));
  });

  it("should return 500 if backend fetch fails (production mode)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fakeToken = createFakeJwt({ tenant_id: "tenant-1" });
    vi.mocked(getServerSession).mockResolvedValue({
      accessToken: fakeToken,
      expires: "12345",
    });
    vi.mocked(getToken).mockResolvedValue({
      accessToken: fakeToken,
    } as any);
    
    // Simulate backend failure
    mockFetch.mockRejectedValueOnce(new Error("Network Error"));
    
    const request = new NextRequest("http://localhost:3000/api/embed/metabase?dashboard_id=1");
    const response = await GET(request);
    
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain("Backend Error");
    
    // Restore
    vi.stubEnv("NODE_ENV", "development");
  });
});
