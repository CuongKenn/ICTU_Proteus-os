// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshAccessToken } from "./tokenRefresh";

describe("refreshAccessToken concurrency & isolation (#686)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("concurrent refreshes for different users do not cross-contaminate tokens", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const body = new URLSearchParams(init?.body as string);
      const refreshToken = body.get("refresh_token");

      // Giả lập network delay nhỏ
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (refreshToken === "refresh-token-user-a") {
        return {
          ok: true,
          json: async () => ({
            access_token: "new-access-token-A",
            refresh_token: "new-refresh-token-A",
            expires_in: 3600,
          }),
        };
      } else if (refreshToken === "refresh-token-user-b") {
        return {
          ok: true,
          json: async () => ({
            access_token: "new-access-token-B",
            refresh_token: "new-refresh-token-B",
            expires_in: 3600,
          }),
        };
      }
      return { ok: false };
    });

    globalThis.fetch = fetchMock as any;

    const tokenUserA = {
      sub: "user-a-id",
      refreshToken: "refresh-token-user-a",
      accessToken: "old-access-a",
    };

    const tokenUserB = {
      sub: "user-b-id",
      refreshToken: "refresh-token-user-b",
      accessToken: "old-access-b",
    };

    // Chạy song song cả hai refresh
    const [resultA, resultB] = await Promise.all([
      refreshAccessToken(tokenUserA as any),
      refreshAccessToken(tokenUserB as any),
    ]);

    expect(resultA.accessToken).toBe("new-access-token-A");
    expect(resultA.refreshToken).toBe("new-refresh-token-A");
    expect(resultA.sub).toBe("user-a-id");

    expect(resultB.accessToken).toBe("new-access-token-B");
    expect(resultB.refreshToken).toBe("new-refresh-token-B");
    expect(resultB.sub).toBe("user-b-id");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("concurrent refreshes for the same user are deduplicated into one request", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        ok: true,
        json: async () => ({
          access_token: "deduped-access-token",
          expires_in: 3600,
        }),
      };
    });

    globalThis.fetch = fetchMock as any;

    const tokenUser = {
      sub: "same-user-id",
      refreshToken: "same-refresh-token",
      accessToken: "old-access",
    };

    const [r1, r2] = await Promise.all([
      refreshAccessToken(tokenUser as any),
      refreshAccessToken(tokenUser as any),
    ]);

    expect(r1.accessToken).toBe("deduped-access-token");
    expect(r2.accessToken).toBe("deduped-access-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
