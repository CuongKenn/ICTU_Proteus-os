import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePlugins } from "@/hooks/usePlugins";
import api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("@/store/notificationStore", () => ({
  useNotificationStore: {
    getState: () => ({
      addToast: vi.fn(),
    }),
  },
}));

describe("usePlugins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch and return plugins list", async () => {
    const mockPlugins = [{ id: "1", name: "plugin-a" }, { id: "2", name: "plugin-b" }];
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: mockPlugins } });

    const { result } = renderHook(() => usePlugins());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.plugins).toEqual(mockPlugins);
    expect(result.current.error).toBeNull();
  });

  it("should handle error state", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("Network Error"));

    const { result } = renderHook(() => usePlugins());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Không thể tải danh sách Plugin. Vui lòng thử lại.");
    expect(result.current.plugins).toEqual([]);
  });
});
