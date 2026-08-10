import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketplaceClient } from "./MarketplaceClient";
import { useSession } from "next-auth/react";
import { useMarketplace } from "@/hooks/useMarketplace";
import { usePlugins } from "@/hooks/usePlugins";
import { useInstallPlugin } from "@/hooks/useInstallPlugin";

// Mock hooks
vi.mock("next-auth/react");
vi.mock("@/hooks/useMarketplace");
vi.mock("@/hooks/usePlugins");
vi.mock("@/hooks/useInstallPlugin");

describe("MarketplaceClient", () => {
  const mockInstallPlugin = vi.fn();
  const mockUninstallPlugin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useSession as any).mockReturnValue({
      data: { user: { roles: ["tenant_admin"] } },
    });

    (useMarketplace as any).mockReturnValue({
      plugins: [
        {
          id: "2",
          code_name: "crm-module",
          display_name: "CRM Tối giản",
          description: "CRM desc",
          version: "1.0.0",
          author: "ICTU Team",
          is_official: true,
          download_count: 85,
        }
      ],
      isLoading: false,
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
        }
      ],
      isLoading: false,
      refetch: vi.fn(),
    });

    (useInstallPlugin as any).mockReturnValue({
      installingId: null,
      installProgress: 0,
      installStatus: null,
      installPlugin: mockInstallPlugin,
      uninstallPlugin: mockUninstallPlugin,
    });
  });

  it("renders both installed and available plugins", () => {
    render(<MarketplaceClient />);
    expect(screen.getByText("HR Pro")).toBeInTheDocument(); // Installed
    expect(screen.getByText("CRM Tối giản")).toBeInTheDocument(); // Available
  });

  it("opens install preview dialog when INSTALL is clicked", async () => {
    render(<MarketplaceClient />);
    const installBtn = screen.getByText("INSTALL");
    fireEvent.click(installBtn);

    expect(screen.getByText("Xác nhận cài đặt Plugin")).toBeInTheDocument();
    expect(screen.getByText(/Bạn đang chuẩn bị cài đặt/)).toBeInTheDocument();
  });

  it("calls installPlugin when confirmed", async () => {
    render(<MarketplaceClient />);
    fireEvent.click(screen.getByText("INSTALL"));

    const confirmBtn = screen.getByRole("button", { name: "Cài đặt" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockInstallPlugin).toHaveBeenCalledWith("2");
    });
  });

  it("opens uninstall confirm modal and requires typing name", async () => {
    render(<MarketplaceClient />);
    
    // Trashing icon is rendered as button with title="Gỡ cài đặt" in active state
    const uninstallBtn = screen.getByTitle("Gỡ cài đặt");
    fireEvent.click(uninstallBtn);

    expect(screen.getByText("Gỡ cài đặt Plugin")).toBeInTheDocument();
    expect(screen.getByText(/Bạn có chắc chắn muốn gỡ cài đặt/)).toBeInTheDocument();

    const confirmBtn = screen.getByText("Gỡ cài đặt", { selector: "button.bg-danger" });
    expect(confirmBtn).toBeDisabled();

    // Type plugin name to enable button
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
      data: { user: { roles: ["hr_manager"] } },
    });
    render(<MarketplaceClient />);

    expect(screen.queryByText("INSTALL")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Gỡ cài đặt")).not.toBeInTheDocument();
  });
});
