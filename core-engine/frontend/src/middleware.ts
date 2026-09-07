// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/((?!$|login|signup|api/auth|api/onboarding|_next/static|_next/image|favicon.ico).*)",
  ],
};
