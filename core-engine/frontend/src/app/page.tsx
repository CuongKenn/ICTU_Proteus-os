// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LandingPage } from "@/components/home/LandingPage";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  // Nếu đã đăng nhập → vào thẳng dashboard, không cho quay lại landing page
  if (session) {
    redirect("/launchpad");
  }

  return <LandingPage />;
}
