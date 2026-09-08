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

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: any) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor — xử lý token refresh và lỗi global
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Nếu BFF trả về 401 (AccessTokenExpired hoặc token hết hạn)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Import động NextAuth
        const { getSession, signOut } = await import("next-auth/react");

        // getSession() sẽ trigger route /api/auth/session của NextAuth
        // Từ đó kích hoạt callback `jwt()` để chạy logic refreshAccessToken()
        // và lưu kết quả cookie mới.
        const session = await getSession();

        // Nếu NextAuth refresh thất bại (refresh_token hết hạn)
        if (session && (session as any).error === "RefreshAccessTokenError") {
          throw new Error("Refresh token expired");
        }

        // Refresh thành công, tiến hành retry
        processQueue(null, "Success");
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        // Bắt buộc đăng xuất
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          const { signOut } = await import("next-auth/react");
          await signOut({ callbackUrl: "/login" });
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
