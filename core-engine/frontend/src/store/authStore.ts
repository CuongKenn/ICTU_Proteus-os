// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Zustand Global Store — Auth State
// Lưu thông tin User đã đăng nhập.
// KHÔNG lưu JWT Token ở đây — token được NextAuth quản lý trong HttpOnly cookie.
// Tham chiếu: docs/clarification.md §8, AGENTS.md §2

import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  tenantId: string;
  roles: string[];
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  clearAuth: () => void;
  hasRole: (role: string) => boolean;
}

const storeDefinition = (set: Parameters<typeof create<AuthState>>[0], get: any) => ({
  user: null as User | null,
  isLoading: true,

  setUser: (user: User | null) => set({ user, isLoading: false }),
  setLoading: (isLoading: boolean) => set({ isLoading }),
  clearAuth: () => set({ user: null, isLoading: false }),

  hasRole: (role: string) => {
    const { user } = get();
    return user?.roles.includes(role) ?? false;
  },
});

// Fix 10: devtools chỉ bật ở development — không expose store name ra production browser DevTools
export const useAuthStore =
  process.env.NODE_ENV === "development"
    ? create<AuthState>()(devtools(storeDefinition, { name: "AuthStore" }))
    : create<AuthState>()(storeDefinition);
