// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginForm } from "./LoginForm";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useNotificationStore } from "@/store/notificationStore";
import React from "react";

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
}));

// Mock i18n — return Vietnamese translations for known keys
const translations: Record<string, string> = {
  "auth.welcome": "Chào mừng trở lại",
  "auth.login_desc": "Đăng nhập để tiếp tục vào workspace của bạn.",
  "auth.login_sso": "Đăng nhập với SSO",
  "auth.protected": "Được bảo vệ bằng Keycloak Identity Provider",
};
vi.mock("@/components/i18n/LanguageContext", () => ({
  useLang: () => ({
    t: (key: string) => translations[key] || key,
    lang: "vi",
  }),
}));

// Mock LanguageToggle
vi.mock("@/components/i18n/LanguageToggle", () => ({
  LanguageToggle: () => null,
}));

describe("LoginForm", () => {
  const mockAddToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.setState({ addToast: mockAddToast, toasts: [], removeToast: vi.fn() });
  });

  it("renders correctly with default state", () => {
    (useSearchParams as any).mockReturnValue({
      get: (key: string) => (key === "callbackUrl" ? "/" : null),
    });

    render(<LoginForm />);

    expect(screen.getByText("Chào mừng trở lại")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /đăng nhập với sso/i })).toBeInTheDocument();
  });

  it("calls signIn when login button is clicked", async () => {
    (useSearchParams as any).mockReturnValue({
      get: (key: string) => (key === "callbackUrl" ? "/dashboard" : null),
    });

    render(<LoginForm />);

    const loginButton = screen.getByRole("button", { name: /đăng nhập với sso/i });
    fireEvent.click(loginButton);

    expect(signIn).toHaveBeenCalledWith("keycloak", { callbackUrl: "/dashboard" });
    await waitFor(() => {
      expect(loginButton).toBeDisabled();
    });
  });

  it("shows error toast when error param is present", () => {
    (useSearchParams as any).mockReturnValue({
      get: (key: string) => {
        if (key === "error") return "AccessDenied";
        if (key === "callbackUrl") return "/";
        return null;
      },
    });

    render(<LoginForm />);

    expect(mockAddToast).toHaveBeenCalled();
  });

  it("shows session expired message and toast when error is RefreshAccessTokenError", () => {
    (useSearchParams as any).mockReturnValue({
      get: (key: string) => {
        if (key === "error") return "RefreshAccessTokenError";
        if (key === "callbackUrl") return "/";
        return null;
      },
    });

    render(<LoginForm />);

    expect(mockAddToast).toHaveBeenCalledWith("error", "Phiên làm việc hết hạn. Vui lòng đăng nhập lại.", 10000);
    expect(screen.getByText(/Phiên làm việc đã hết hạn/i)).toBeInTheDocument();
  });
});
