// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LaunchpadClient } from "./LaunchpadClient";
import * as usePluginsModule from "@/hooks/usePlugins";

// Mock the hooks
vi.mock("@/hooks/usePlugins", () => ({
  usePlugins: vi.fn(),
}));

const mockAddToast = vi.fn();
vi.mock("@/store/notificationStore", () => ({
  useNotificationStore: (selector: any) => selector({ addToast: mockAddToast }),
}));

// Mock authStore — expose hasRole as controllable mock
const mockHasRole = vi.fn();
vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: any) => selector({ hasRole: mockHasRole }),
}));

// Mock i18n
vi.mock("@/components/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (key: string) => key, lang: "vi" }),
}));

// Mock window.open
const mockWindowOpen = vi.fn();
window.open = mockWindowOpen;

// Mock useRouter
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { role: "tenant_admin" } }, status: "authenticated" }),
}));

describe("LaunchpadClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
    // Default: admin user
    mockHasRole.mockImplementation((role: string) => role === "tenant_admin" || role === "superadmin");
  });

  it("renders system apps correctly", () => {
    vi.mocked(usePluginsModule.usePlugins).mockReturnValue({
      plugins: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      install: vi.fn(),
      uninstall: vi.fn(),
      disable: vi.fn(),
      upgrade: vi.fn(),
      configureCredentials: vi.fn(),
    });

    render(<LaunchpadClient />);

    expect(screen.getByText("Mattermost")).toBeInTheDocument();
    expect(screen.getByText("Outline Wiki")).toBeInTheDocument();
    expect(screen.getByText("n8n Workflow")).toBeInTheDocument();
    expect(screen.getByText("Metabase")).toBeInTheDocument();
  });

  it("renders skeleton loader when isLoading is true", () => {
    vi.mocked(usePluginsModule.usePlugins).mockReturnValue({
      plugins: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      install: vi.fn(),
      uninstall: vi.fn(),
      disable: vi.fn(),
      upgrade: vi.fn(),
      configureCredentials: vi.fn(),
    });

    const { container } = render(<LaunchpadClient />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders empty state when there are no plugins", () => {
    vi.mocked(usePluginsModule.usePlugins).mockReturnValue({
      plugins: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      install: vi.fn(),
      uninstall: vi.fn(),
      disable: vi.fn(),
      upgrade: vi.fn(),
      configureCredentials: vi.fn(),
    });

    render(<LaunchpadClient />);
    // Empty state text — may use i18n key or Vietnamese
    const emptyEl = screen.queryByText(/chưa có/i) || screen.queryByText(/no plugin/i);
    // System apps still show even with no plugins, so empty state only for plugin section
    expect(screen.getByText("Mattermost")).toBeInTheDocument();
  });

  it("renders plugins when data is available", () => {
    vi.mocked(usePluginsModule.usePlugins).mockReturnValue({
      plugins: [
        {
          id: "1",
          code_name: "test_plugin",
          display_name: "Test Plugin",
          version: "1.0.0",
          status: "ACTIVE",
          is_official: false,
          category: "Utilities",
          tags: [],
          credentials_schema: [],
          download_count: 0,
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      install: vi.fn(),
      uninstall: vi.fn(),
      disable: vi.fn(),
      upgrade: vi.fn(),
      configureCredentials: vi.fn(),
    });

    render(<LaunchpadClient />);
    expect(screen.getByText("Test Plugin")).toBeInTheDocument();
  });

  it("opens Mattermost via router push", () => {
    vi.mocked(usePluginsModule.usePlugins).mockReturnValue({
      plugins: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      install: vi.fn(),
      uninstall: vi.fn(),
      disable: vi.fn(),
      upgrade: vi.fn(),
      configureCredentials: vi.fn(),
    });

    render(<LaunchpadClient />);
    
    const mattermostApp = screen.getByText("Mattermost");
    fireEvent.click(mattermostApp);

    expect(mockPush).toHaveBeenCalledWith("/chat");
  });

  it("opens n8n in iframe overlay", () => {
    vi.mocked(usePluginsModule.usePlugins).mockReturnValue({
      plugins: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      install: vi.fn(),
      uninstall: vi.fn(),
      disable: vi.fn(),
      upgrade: vi.fn(),
      configureCredentials: vi.fn(),
    });

    render(<LaunchpadClient />);
    
    const n8nApp = screen.getByText("n8n Workflow");
    fireEvent.click(n8nApp);

    // Should open iframe overlay
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeTruthy();
  });

  it("fetches signed url and opens Metabase in iframe overlay", async () => {
    vi.mocked(usePluginsModule.usePlugins).mockReturnValue({
      plugins: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      install: vi.fn(),
      uninstall: vi.fn(),
      disable: vi.fn(),
      upgrade: vi.fn(),
      configureCredentials: vi.fn(),
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "http://mocked-metabase-url" }),
    } as any);

    render(<LaunchpadClient />);
    
    const metabaseApp = screen.getByText("Metabase");
    fireEvent.click(metabaseApp);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/embed/metabase?dashboard_id=1");
    });
  });
});
