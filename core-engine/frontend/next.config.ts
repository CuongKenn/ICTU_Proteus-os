// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Tối ưu cho Docker deployment
  // Proxy qua BFF — không expose BACKEND_URL ra client
  async rewrites() {
    return [];
  },
};

export default nextConfig;
