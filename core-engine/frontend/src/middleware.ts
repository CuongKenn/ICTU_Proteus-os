// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

export { default } from "next-auth/middleware";

export const config = {
  // api/proxy được exclude để: (1) preflight OPTIONS từ Micro-Frontend
  // (plugins.proteus.local, không kèm cookie) về 204+CORS thay vì 307 signin;
  // (2) request thiếu session nhận 401 JSON thay vì redirect HTML.
  // Auth vẫn enforced trong từng BFF route bằng getToken().
  matcher: [
    "/((?!$|login|signup|api/auth|api/onboarding|api/proxy|_next/static|_next/image|favicon.ico).*)",
  ],
};
