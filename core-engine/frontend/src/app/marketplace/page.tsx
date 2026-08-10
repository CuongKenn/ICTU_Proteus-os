import { Metadata } from "next";
import { MarketplaceClient } from "./MarketplaceClient";

export const metadata: Metadata = {
  title: "Marketplace | Proteus OS",
  description: "Khám phá và cài đặt các plugin cho Proteus OS.",
};

export default function MarketplacePage() {
  return (
    <main className="min-h-[calc(100vh-56px)] bg-bg-base overflow-y-auto">
      <MarketplaceClient />
    </main>
  );
}
