// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMarketplace } from "./useMarketplace";
import api from "@/lib/api";

vi.mock("@/lib/api");
vi.mock("@/store/notificationStore", () => ({
  useNotificationStore: {
    getState: () => ({ addToast: vi.fn() }),
  },
}));
vi.mock("@/hooks/usePlugins", () => ({
  usePlugins: () => ({
    plugins: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    install: vi.fn().mockResolvedValue({ task_id: "fake-123" }),
    uninstall: vi.fn().mockResolvedValue(undefined),
    disable: vi.fn(),
    upgrade: vi.fn(),
  }),
}));


const mockPlugins = [
  {
    id: "hr-module",
    code_name: "hr-module",
    display_name: "Quản lý Nhân sự Pro",
    description: "HR plugin",
    version: "2.1.0",
    author: "ICTU Team",
    is_official: true,
    download_count: 120,
  },
];

describe("useMarketplace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and returns marketplace plugin list", async () => {
    (api.get as any) = vi.fn().mockResolvedValue({ data: { items: mockPlugins, total: 1 } });

    const { result } = renderHook(() => useMarketplace());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.plugins).toHaveLength(1);
    expect(result.current.plugins[0].display_name).toBe("Quản lý Nhân sự Pro");
    expect(result.current.error).toBeNull();
  });

  it("falls back to mock data when NEXT_PUBLIC_ENABLE_MOCKS is true on error", async () => {
    const originalEnv = process.env.NEXT_PUBLIC_ENABLE_MOCKS;
    (process.env as any).NEXT_PUBLIC_ENABLE_MOCKS = "true";
    (api.get as any) = vi.fn().mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useMarketplace());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have fallback mock plugins
    expect(result.current.plugins.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();

    (process.env as any).NEXT_PUBLIC_ENABLE_MOCKS = originalEnv;
  });

  it("starts with correct install state machine values", () => {
    (api.get as any) = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });

    const { result } = renderHook(() => useMarketplace());

    expect(result.current.installingId).toBeNull();
    expect(result.current.installProgress).toBe(0);
    expect(result.current.installStatus).toBeNull();
  });
});
