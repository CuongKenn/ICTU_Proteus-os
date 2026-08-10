import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/store/authStore";

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("should set user correctly", () => {
    const mockUser = {
      id: "1",
      email: "test@example.com",
      name: "Test User",
      tenantId: "tenant-1",
      roles: ["admin"],
    };

    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("should clear auth correctly", () => {
    const mockUser = {
      id: "1",
      email: "test@example.com",
      name: "Test User",
      tenantId: "tenant-1",
      roles: ["admin"],
    };

    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("should correctly check roles via hasRole", () => {
    const mockUser = {
      id: "1",
      email: "test@example.com",
      name: "Test User",
      tenantId: "tenant-1",
      roles: ["admin", "manager"],
    };

    useAuthStore.getState().setUser(mockUser);

    expect(useAuthStore.getState().hasRole("admin")).toBe(true);
    expect(useAuthStore.getState().hasRole("manager")).toBe(true);
    expect(useAuthStore.getState().hasRole("viewer")).toBe(false);
  });

  it("should return false for hasRole when user is null", () => {
    expect(useAuthStore.getState().hasRole("admin")).toBe(false);
  });
});
