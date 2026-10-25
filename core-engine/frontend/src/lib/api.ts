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

// Response interceptor — xử lý token refresh và lỗi global.
// LƯU Ý: BFF proxy đã tự refresh + persist refresh_token xoay vào cookie.
// Interceptor KHÔNG gọi getSession() (tránh refresh song song gây reuse
// refresh_token single-use của Keycloak). Thay vào đó retry 1 lần để BFF
// refresh; chỉ signOut khi vẫn 401 sau retry (refresh_token thật sự hết hạn).
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Retry qua BFF proxy — proxy sẽ refresh token inline và set cookie mới.
        const retryRes = await api(originalRequest);
        processQueue(null, "Success");
        return retryRes;
      } catch (err: any) {
        processQueue(err, null);
        // Chỉ đăng xuất khi retry VẪN 401 (refresh_token hết hạn/revoke thật).
        // Dùng federated logout để xóa cả SSO cookie trên Keycloak,
        // nếu không lần vào lại sẽ tự login lại mà không hỏi mật khẩu.
        if (err?.response?.status === 401) {
          if (
            typeof window !== "undefined" &&
            !window.location.pathname.startsWith("/login")
          ) {
            try {
              const res = await fetch("/api/auth/federated-logout")
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null);
              const { signOut } = await import("next-auth/react");
              if (res?.url && res.url !== "/login") {
                await signOut({ redirect: false }).catch(() => null);
                window.location.href = res.url;
                return Promise.reject(err);
              }
              await signOut({ callbackUrl: "/login" });
            } catch {
              const { signOut } = await import("next-auth/react");
              await signOut({ callbackUrl: "/login" });
            }
          }
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
