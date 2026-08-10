// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// useAICommand — Custom Hook quản lý AI Chat Widget state & logic
// Tách biệt hoàn toàn Business Logic khỏi UI (AGENTS.md §2, §8)
// Giao tiếp qua BFF /api/ai/command (không gọi FastAPI trực tiếp)
// Tham chiếu: docs/architecture.md §2.1 (BFF Pattern), docs/dsl-spec.md

import { useState, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useNotificationStore } from "@/store/notificationStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WidgetState = "collapsed" | "expanded" | "thinking" | "awaiting_approval";

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface DslPreview {
  command_id: string;
  action: string;
  effect: "read" | "write" | "critical";
  approval_message: string;
  dry_run_result?: {
    affected_count: number;
    preview: Array<Record<string, unknown>>;
  };
  approval_deadline: string;
}

interface AICommandBFFResponse {
  /** effect=read: trả kết quả trực tiếp */
  result?: string;
  /** effect=write/critical: DSL preview để hiển thị awaiting_approval */
  dsl_preview?: DslPreview;
  /** Trạng thái xử lý */
  status: "completed" | "pending_approval" | "error";
  message: string;
}

interface UseAICommandReturn {
  widgetState: WidgetState;
  messages: ChatMessage[];
  inputValue: string;
  dslPreview: DslPreview | null;
  sessionId: string;
  setInputValue: (value: string) => void;
  openWidget: () => void;
  closeWidget: () => void;
  sendCommand: () => Promise<void>;
  openMattermostApproval: () => void;
  cancelApproval: () => void;
}

// ─── Mock Dev Responses ───────────────────────────────────────────────────────

const MOCK_RESPONSES = {
  read: {
    status: "completed" as const,
    message: "Đã xử lý thành công",
    result:
      "📊 **Báo cáo tuần này (04/08 – 10/08/2026):**\n- Tổng đơn nghỉ phép: **15**\n- Đã duyệt: **8** ✅\n- Đang chờ: **5** ⏳\n- Bị từ chối: **2** ❌",
  },
  write: {
    status: "pending_approval" as const,
    message: "Lệnh cần phê duyệt từ Ban Giám đốc",
    dsl_preview: {
      command_id: uuidv4(),
      action: "hr.leave_requests.batch_approve",
      effect: "write" as const,
      approval_message:
        "⚠️ Tôi chuẩn bị DUYỆT 5 đơn nghỉ phép đang chờ xử lý. Vui lòng xác nhận trên Mattermost.",
      dry_run_result: {
        affected_count: 5,
        preview: [
          { employee_name: "Nguyễn Văn A", days: 2, type: "annual" },
          { employee_name: "Trần Thị B", days: 1, type: "sick" },
          { employee_name: "Lê Hoàng C", days: 3, type: "annual" },
        ],
      },
      approval_deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    },
  },
};

function detectEffectFromInput(input: string): "read" | "write" {
  const writeKeywords = ["duyệt", "phê duyệt", "xóa", "chỉnh sửa", "cài đặt", "gỡ", "tắt", "bật", "approve"];
  const lower = input.toLowerCase();
  return writeKeywords.some((kw) => lower.includes(kw)) ? "write" : "read";
}

// ─── Hook Implementation ───────────────────────────────────────────────────────

export function useAICommand(): UseAICommandReturn {
  const [widgetState, setWidgetState] = useState<WidgetState>("collapsed");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uuidv4(),
      role: "assistant",
      content: "Xin chào! Tôi là Proteus AI. Tôi có thể giúp bạn truy vấn dữ liệu hoặc thực hiện các tác vụ quản trị. Hãy nhập lệnh bằng tiếng Việt tự nhiên.",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [dslPreview, setDslPreview] = useState<DslPreview | null>(null);
  const sessionIdRef = useRef<string>(uuidv4());

  const { addToast } = useNotificationStore();

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const openWidget = useCallback(() => {
    setWidgetState("expanded");
  }, []);

  const closeWidget = useCallback(() => {
    setWidgetState("collapsed");
    setDslPreview(null);
  }, []);

  const appendMessage = useCallback((role: MessageRole, content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: uuidv4(), role, content, timestamp: new Date() },
    ]);
  }, []);

  /**
   * sendCommand — Gửi lệnh tới BFF /api/ai/command
   * BFF sẽ inject JWT Token từ HttpOnly Cookie và forward tới FastAPI.
   * effect=read → hiển thị kết quả ngay.
   * effect=write/critical → chuyển sang state awaiting_approval + hiện DSL preview.
   */
  const sendCommand = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || widgetState === "thinking") return;

    // Thêm tin nhắn người dùng
    appendMessage("user", trimmed);
    setInputValue("");
    setWidgetState("thinking");

    try {
      const response = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          natural_language_input: trimmed,
          session_id: sessionIdRef.current,
        }),
      });

      let data: AICommandBFFResponse;

      if (!response.ok && process.env.NODE_ENV === "development") {
        // Dev fallback: mock response khi API chưa có
        const detectedEffect = detectEffectFromInput(trimmed);
        data = MOCK_RESPONSES[detectedEffect] as AICommandBFFResponse;
      } else if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      } else {
        data = await response.json();
      }

      if (data.status === "completed" && data.result) {
        // effect=read: hiển thị kết quả ngay
        appendMessage("assistant", data.result);
        setWidgetState("expanded");
      } else if (data.status === "pending_approval" && data.dsl_preview) {
        // effect=write/critical: chờ phê duyệt
        setDslPreview(data.dsl_preview);
        appendMessage(
          "assistant",
          `🔒 Lệnh này yêu cầu phê duyệt từ Ban Giám đốc.\n\n**Hành động:** \`${data.dsl_preview.action}\`\n\nVui lòng bấm **"Phê duyệt trên Mattermost"** để tiếp tục.`
        );
        setWidgetState("awaiting_approval");
      } else {
        appendMessage("assistant", data.message || "Đã xảy ra lỗi không xác định.");
        setWidgetState("expanded");
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        // Dev fallback
        const detectedEffect = detectEffectFromInput(trimmed);
        const mockData = MOCK_RESPONSES[detectedEffect];
        if (mockData.status === "pending_approval" && "dsl_preview" in mockData && mockData.dsl_preview) {
          setDslPreview({ ...mockData.dsl_preview, command_id: uuidv4() });
          appendMessage(
            "assistant",
            `🔒 Lệnh này yêu cầu phê duyệt từ Ban Giám đốc.\n\n**Hành động:** \`${mockData.dsl_preview.action}\`\n\nVui lòng bấm **"Phê duyệt trên Mattermost"** để tiếp tục.`
          );
          setWidgetState("awaiting_approval");
        } else if (mockData.status === "completed" && "result" in mockData && mockData.result) {
          appendMessage("assistant", mockData.result);
          setWidgetState("expanded");
        }
      } else {
        appendMessage("assistant", "❌ Không thể kết nối tới AI Service. Vui lòng thử lại sau.");
        addToast("error", "Lỗi kết nối AI Service");
        setWidgetState("expanded");
      }
    }
  }, [inputValue, widgetState, appendMessage, addToast]);

  /**
   * openMattermostApproval — Mở Mattermost để phê duyệt.
   * Widget ở trạng thái awaiting_approval, người dùng bấm nút này để
   * chuyển sang Mattermost bấm [Phê duyệt].
   * Rule sinh tử: AI KHÔNG tự bypass bước này (AGENTS.md §4).
   */
  const openMattermostApproval = useCallback(() => {
    // Mở Mattermost — trong production, URL này từ env config
    const mattermostUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || "/chat";
    window.open(mattermostUrl, "_blank", "noopener,noreferrer");
    addToast(
      "info",
      "Đã mở Mattermost. Vui lòng bấm [Phê duyệt] trên tin nhắn từ Proteus AI."
    );
  }, [addToast]);

  /**
   * cancelApproval — Huỷ lệnh đang chờ phê duyệt.
   */
  const cancelApproval = useCallback(() => {
    setDslPreview(null);
    appendMessage("assistant", "🚫 Lệnh đã được huỷ bỏ.");
    setWidgetState("expanded");
  }, [appendMessage]);

  return {
    widgetState,
    messages,
    inputValue,
    dslPreview,
    sessionId: sessionIdRef.current,
    setInputValue,
    openWidget,
    closeWidget,
    sendCommand,
    openMattermostApproval,
    cancelApproval,
  };
}
