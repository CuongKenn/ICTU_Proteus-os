// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token) {
      return NextResponse.json({ url: "/login" });
    }

    const idToken = token.idToken as string;
    if (!idToken) {
      return NextResponse.json({ url: "/login" });
    }

    const issuerUrl = process.env.KEYCLOAK_ISSUER;
    if (!issuerUrl) {
      logger.warn("Missing KEYCLOAK_ISSUER for federated logout");
      return NextResponse.json({ url: "/login" });
    }

    const postLogoutRedirectUri = new URL("/login", req.url).toString();
    const logoutUrl = `${issuerUrl}/protocol/openid-connect/logout?id_token_hint=${idToken}&post_logout_redirect_uri=${encodeURIComponent(
      postLogoutRedirectUri
    )}`;

    return NextResponse.json({ url: logoutUrl });
  } catch (error) {
    logger.error("Federated logout error:", error);
    return NextResponse.json({ url: "/login" });
  }
}
