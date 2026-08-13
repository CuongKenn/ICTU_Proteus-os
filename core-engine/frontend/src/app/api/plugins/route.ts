// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// BFF API Route — GET /api/plugins
// Proxy tới FastAPI: GET /api/v1/plugins

import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request });
  const session = await getServerSession(authOptions);

  if (!token?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetUrl = `${BACKEND_URL}/api/v1/plugins${request.nextUrl.search}`;

  try {
    const backendResponse = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: "application/json",
      },
    });

    const data = await backendResponse.json().catch(() => null);
    return NextResponse.json(data, { status: backendResponse.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Service Unavailable", message: "Không thể kết nối tới Backend." },
      { status: 503 }
    );
  }
}
