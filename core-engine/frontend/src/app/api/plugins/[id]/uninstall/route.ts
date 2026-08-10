// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// BFF API Route — POST /api/plugins/[id]/uninstall
// Proxy tới FastAPI: DELETE /api/v1/plugins/[id]

import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetUrl = `${BACKEND_URL}/api/v1/plugins/${params.id}`;

  try {
    const backendResponse = await fetch(targetUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/json",
      },
    });

    const contentType = backendResponse.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = await backendResponse.json().catch(() => null);
      return NextResponse.json(data, { status: backendResponse.status });
    }
    
    return new NextResponse(null, { status: backendResponse.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Service Unavailable", message: "Không thể kết nối tới Backend." },
      { status: 503 }
    );
  }
}
