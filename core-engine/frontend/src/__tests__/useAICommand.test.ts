import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAICommand } from "@/hooks/useAICommand";

vi.mock("@/store/notificationStore", () => ({
  useNotificationStore: () => ({
    addToast: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useAICommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useAICommand());

    expect(result.current.widgetState).toBe("collapsed");
    expect(result.current.messages.length).toBe(1);
    expect(result.current.messages[0].role).toBe("assistant");
    expect(result.current.inputValue).toBe("");
    expect(result.current.dslPreview).toBeNull();
  });

  it("should handle widget open/close", () => {
    const { result } = renderHook(() => useAICommand());

    act(() => {
      result.current.openWidget();
    });
    expect(result.current.widgetState).toBe("expanded");

    act(() => {
      result.current.closeWidget();
    });
    expect(result.current.widgetState).toBe("collapsed");
  });

  it("should process a read command successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "completed",
        result: "Read result",
      }),
    });

    const { result } = renderHook(() => useAICommand());

    act(() => {
      result.current.setInputValue("Lấy dữ liệu");
    });

    await act(async () => {
      await result.current.sendCommand();
    });

    expect(result.current.widgetState).toBe("expanded");
    expect(result.current.messages[result.current.messages.length - 1].content).toBe("Read result");
    expect(result.current.messages[result.current.messages.length - 1].role).toBe("assistant");
    expect(result.current.inputValue).toBe("");
  });

  it("should process a write command and transition to awaiting_approval", async () => {
    const dsl_preview = {
      command_id: "cmd-1",
      action: "test.action",
      effect: "write",
      approval_message: "Need approval",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "pending_approval",
        dsl_preview,
      }),
    });

    const { result } = renderHook(() => useAICommand());

    act(() => {
      result.current.setInputValue("Duyệt lệnh này");
    });

    await act(async () => {
      await result.current.sendCommand();
    });

    expect(result.current.widgetState).toBe("awaiting_approval");
    expect(result.current.dslPreview).toEqual(dsl_preview);
  });
});
