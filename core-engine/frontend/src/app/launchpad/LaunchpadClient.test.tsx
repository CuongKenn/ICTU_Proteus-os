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

describe("LaunchpadClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
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

    expect(screen.getByText("Launchpad")).toBeInTheDocument();
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
    const skeletons = container.querySelectorAll(".animate-pulse-slow");
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
    expect(screen.getByText("Chưa có Plugin nào")).toBeInTheDocument();
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
    expect(screen.queryByText("Chưa có Plugin")).not.toBeInTheDocument();
  });

  it("opens Mattermost in new tab", () => {
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
    
    // Mattermost is a system app, so we find it and click
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

    // Should open iframe with n8n overlay title
    expect(screen.getByText(/n8n Workflow/, { selector: "h2" })).toBeInTheDocument();
    const iframe = screen.getByTitle("Đóng (Esc)").parentElement?.nextElementSibling?.querySelector("iframe");
    expect(iframe).toHaveAttribute("src", "http://localhost:5678");
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

    // Should open iframe with metabase
    expect(screen.getByText(/Metabase Analytics/, { selector: "h2" })).toBeInTheDocument();
    const iframe = screen.getByTitle("Đóng (Esc)").parentElement?.nextElementSibling?.querySelector("iframe");
    expect(iframe).toHaveAttribute("src", "http://mocked-metabase-url");
  });
});
