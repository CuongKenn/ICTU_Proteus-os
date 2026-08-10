import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePlugins } from "./usePlugins";
import api from "@/lib/api";

vi.mock("@/lib/api");
vi.mock("@/store/notificationStore", () => ({
  useNotificationStore: {
    getState: () => ({ addToast: vi.fn() }),
  },
}));


describe("usePlugins", () => {
  const mockItems = [
    { id: "1", code_name: "hr-module", display_name: "HR Pro", version: "2.1.0", status: "active", is_official: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and returns plugin list", async () => {
    (api.get as any) = vi.fn().mockResolvedValue({ data: { items: mockItems } });

    const { result } = renderHook(() => usePlugins());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.plugins).toHaveLength(1);
    expect(result.current.plugins[0].display_name).toBe("HR Pro");
    expect(result.current.error).toBeNull();
  });

  it("sets error when fetch fails in production", async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";
    (api.get as any) = vi.fn().mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => usePlugins());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toContain("Không thể tải danh sách Plugin");
    (process.env as any).NODE_ENV = originalEnv;
  });

  it("refetch increments trigger and re-fetches", async () => {
    const mockGet = vi.fn().mockResolvedValue({ data: { items: mockItems } });
    (api.get as any) = mockGet;

    const { result } = renderHook(() => usePlugins());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.refetch(); });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  it("install returns task_id", async () => {
    (api.get as any) = vi.fn().mockResolvedValue({ data: { items: [] } });
    (api.post as any) = vi.fn().mockResolvedValue({ data: { data: { task_id: "abc-123" } } });

    const { result } = renderHook(() => usePlugins());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let taskResult: any;
    await act(async () => {
      taskResult = await result.current.install("hr-module");
    });

    expect(taskResult.task_id).toBe("abc-123");
  });
});
