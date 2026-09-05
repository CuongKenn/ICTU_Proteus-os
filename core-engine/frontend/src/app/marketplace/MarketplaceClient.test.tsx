// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketplaceClient } from "./MarketplaceClient";
import { useSession } from "@/hooks/useSession";
import { useMarketplace } from "@/hooks/useMarketplace";
import { usePlugins } from "@/hooks/usePlugins";

// Mock hooks
vi.mock("@/hooks/useSession");
vi.mock("@/hooks/useMarketplace");
vi.mock("@/hooks/usePlugins");

describe("MarketplaceClient", () => {
  const mockInstallPlugin = vi.fn();
  const mockUninstallPlugin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useSession as any).mockReturnValue({
      user: { name: "Admin", roles: ["tenant_admin"] },
      status: "authenticated",
      isLoading: false,
      hasRole: (role: string) => role === "tenant_admin",
    });

    (useMarketplace as any).mockReturnValue({
      plugins: [
        {
          id: "crm-module",
          code_name: "crm-module",
          display_name: "CRM Tối giản",
          description: "CRM desc",
          version: "1.0.0",
          author: "ICTU Team",
          is_official: true,
          download_count: 85,
          category: "CRM",
          tags: ["crm"],
          credentials_schema: [],
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      installingId: null,
      installProgress: 0,
      installStatus: null,
      installPlugin: mockInstallPlugin,
      uninstallPlugin: mockUninstallPlugin,
    });

    (usePlugins as any).mockReturnValue({
      plugins: [
        {
          id: "1",
          code_name: "hr-module",
          display_name: "HR Pro",
          version: "2.1.0",
          is_official: true,
          status: "active",
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      install: vi.fn(),
      uninstall: vi.fn(),
      disable: vi.fn(),
      upgrade: vi.fn(),
    });
  });

  it("renders both installed and available plugins", () => {
    render(<MarketplaceClient />);
    expect(screen.getByText("HR Pro")).toBeInTheDocument();
    expect(screen.getByText("CRM Tối giản")).toBeInTheDocument();
  });

  it("opens install preview dialog when Nhận is clicked", async () => {
    render(<MarketplaceClient />);
    const installBtn = screen.getByText("Nhận");
    fireEvent.click(installBtn);

    expect(screen.getByText("Xác nhận cài đặt Plugin")).toBeInTheDocument();
    expect(screen.getByText(/Bạn đang chuẩn bị cài đặt/)).toBeInTheDocument();
  });

  it("calls installPlugin when confirmed", async () => {
    render(<MarketplaceClient />);
    fireEvent.click(screen.getByText("Nhận"));

    const confirmBtn = screen.getByRole("button", { name: "Cài đặt" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockInstallPlugin).toHaveBeenCalledWith("crm-module", []);
    });
  });

  it("opens uninstall confirm modal and requires typing name", async () => {
    render(<MarketplaceClient />);

    const uninstallBtn = screen.getByTitle("Gỡ cài đặt");
    fireEvent.click(uninstallBtn);

    expect(screen.getByText("Gỡ cài đặt Plugin")).toBeInTheDocument();
    expect(screen.getByText(/Bạn có chắc chắn muốn gỡ cài đặt/)).toBeInTheDocument();

    const confirmBtn = screen.getByText("Gỡ cài đặt", { selector: "button.bg-danger" });
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByPlaceholderText("HR Pro");
    fireEvent.change(input, { target: { value: "HR Pro" } });

    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockUninstallPlugin).toHaveBeenCalledWith("1");
    });
  });

  it("hides install/uninstall actions if not tenant_admin", () => {
    (useSession as any).mockReturnValue({
      user: { name: "User", roles: ["hr_manager"] },
      status: "authenticated",
      isLoading: false,
      hasRole: (_role: string) => false,
    });
    render(<MarketplaceClient />);

    expect(screen.queryByText("Nhận")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Gỡ cài đặt")).not.toBeInTheDocument();
  });
});
