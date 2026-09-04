// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Axios API Client — Gọi BFF Proxy (không gọi Backend trực tiếp)
// Tất cả request đi qua /api/proxy/* (Next.js BFF route).
// Tham chiếu: docs/architecture.md (BFF Pattern)

import axios from "axios";

const api = axios.create({
  baseURL: "/api/proxy", // BFF Proxy — không dùng BACKEND_URL trực tiếp
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30_000,
});

// Response interceptor — xử lý lỗi global
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Session hết hạn — chỉ redirect khi đang ở trang protected (không phải /login)
      // Dùng NextAuth signOut để xóa sạch session trước khi redirect
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        const { signOut } = await import("next-auth/react");
        await signOut({ callbackUrl: "/login" });
      }
    }
    return Promise.reject(error);
  }
);

export default api;
