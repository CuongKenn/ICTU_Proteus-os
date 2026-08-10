import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMarketplace } from "./useMarketplace";

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

const api = await import("@/lib/api");

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
    (api.default.get as any) = vi.fn().mockResolvedValue({ data: { data: mockPlugins } });

    const { result } = renderHook(() => useMarketplace());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.plugins).toHaveLength(1);
    expect(result.current.plugins[0].display_name).toBe("Quản lý Nhân sự Pro");
    expect(result.current.error).toBeNull();
  });

  it("falls back to mock data in development on error", async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "development";
    (api.default.get as any) = vi.fn().mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useMarketplace());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have fallback mock plugins
    expect(result.current.plugins.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();

    (process.env as any).NODE_ENV = originalEnv;
  });

  it("starts with correct install state machine values", () => {
    (api.default.get as any) = vi.fn().mockResolvedValue({ data: { data: [] } });

    const { result } = renderHook(() => useMarketplace());

    expect(result.current.installingId).toBeNull();
    expect(result.current.installProgress).toBe(0);
    expect(result.current.installStatus).toBeNull();
  });
});
