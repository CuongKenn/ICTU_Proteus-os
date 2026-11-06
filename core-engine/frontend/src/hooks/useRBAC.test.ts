// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRBAC } from "./useRBAC";

vi.mock("@/store/authStore", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

describe("useRBAC Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grants all permissions for admin or tenant_admin roles", async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: "1", name: "Admin User", roles: ["tenant_admin"] },
      hasRole: vi.fn((role) => role === "tenant_admin"),
    } as any);

    const { result } = renderHook(() => useRBAC());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasPermission("plugins.install")).toBe(true);
    expect(result.current.hasPermission("plugins:install")).toBe(true);
    expect(result.current.hasPermission("any.random.permission")).toBe(true);
  });

  it("handles permissions as list of strings and normalizes dot/colon", async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: "2", name: "Staff User", roles: ["operator"] },
      hasRole: vi.fn(),
    } as any);

    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          name: "operator",
          display_name: "Operator",
          permissions: ["plugins.install", "users:read"],
        },
      ],
    });

    const { result } = renderHook(() => useRBAC());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // plugins.install matches both dot and colon format
    expect(result.current.hasPermission("plugins.install")).toBe(true);
    expect(result.current.hasPermission("plugins:install")).toBe(true);

    // users:read matches both colon and dot format
    expect(result.current.hasPermission("users:read")).toBe(true);
    expect(result.current.hasPermission("users.read")).toBe(true);

    // Unassigned permission returns false
    expect(result.current.hasPermission("roles.delete")).toBe(false);
  });

  it("handles permissions as dictionary object", async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: "3", name: "Dev User", roles: ["developer"] },
      hasRole: vi.fn(),
    } as any);

    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          name: "developer",
          display_name: "Developer",
          permissions: {
            plugins: ["read", "install"],
            settings: ["read"],
          },
        },
      ],
    });

    const { result } = renderHook(() => useRBAC());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasPermission("plugins:install")).toBe(true);
    expect(result.current.hasPermission("plugins.install")).toBe(true);
    expect(result.current.hasPermission("plugins:read")).toBe(true);
    expect(result.current.hasPermission("plugins:delete")).toBe(false);
  });

  it("handles wildcard *:* correctly", async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: "4", name: "Super User", roles: ["super"] },
      hasRole: vi.fn(),
    } as any);

    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          name: "super",
          display_name: "Super",
          permissions: ["*:*"],
        },
      ],
    });

    const { result } = renderHook(() => useRBAC());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasPermission("plugins.install")).toBe(true);
    expect(result.current.hasPermission("users:delete")).toBe(true);
  });

  it("handles resource wildcard like plugins:* correctly", async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: "5", name: "Plugin Manager", roles: ["plugin_mgr"] },
      hasRole: vi.fn(),
    } as any);

    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          name: "plugin_mgr",
          display_name: "Plugin Manager",
          permissions: ["plugins:*"],
        },
      ],
    });

    const { result } = renderHook(() => useRBAC());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasPermission("plugins:install")).toBe(true);
    expect(result.current.hasPermission("plugins.delete")).toBe(true);
    expect(result.current.hasPermission("users:read")).toBe(false);
  });
});
