// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { authOptions } from "./authOptions";

describe("authOptions callbacks", () => {
  it("session callback never exposes accessToken (#685)", async () => {
    const sessionCallback = authOptions.callbacks?.session;
    expect(sessionCallback).toBeDefined();

    const mockSession = {
      user: { name: "Test User", email: "test@example.com" },
      expires: "2026-12-31T23:59:59Z",
    };
    const mockToken = {
      accessToken: "secret-bearer-token-keycloak",
      roles: ["admin"],
    };

    const result = await sessionCallback!({
      session: mockSession as any,
      token: mockToken as any,
      user: {} as any,
      newSession: {} as any,
      trigger: "update",
    });

    expect((result as any).accessToken).toBeUndefined();
    expect((result as any).user?.roles).toEqual(["admin"]);
  });
});
