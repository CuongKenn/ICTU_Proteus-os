// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Serve dưới subpath /plugins-mfe/ để cùng origin với BFF (nttspace.online)
  // → iframe nhận được session cookie SameSite=Lax, plugin chạy LIVE
  // thay vì fallback DEMO do cookie bị chặn cross-origin.
  base: '/plugins-mfe/',
  server: {
    allowedHosts: true, // Allow all hosts (like crm-frontend.proteus.local)
    // Cho phép import source of truth ở plugins/<code>/frontend/src (ngoài root gateway)
    fs: { allow: ['..', '../..'] },
  },
})
