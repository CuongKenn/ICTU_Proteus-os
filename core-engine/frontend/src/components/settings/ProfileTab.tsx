// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { ExternalLink, User } from "lucide-react";

interface ProfileTabProps {
  session: any;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ session }) => {
  const name = session?.user?.name || "Người dùng";
  const email = session?.user?.email || "Chưa có email";
  const initial = name.charAt(0).toUpperCase();

  const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://auth.proteus.local";
  const accountUrl = `${keycloakUrl}/realms/proteus/account/`;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Profile Details</h2>
        <p className="text-text-secondary text-sm mt-1">
          Manage your personal information and preferences.
        </p>
      </div>

      <div className="flex items-center gap-6 pb-8 border-b border-border">
        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center border-4 border-bg-surface text-primary text-4xl font-bold shrink-0 shadow-sm">
          {initial}
        </div>
        <div>
          <h3 className="text-2xl font-semibold text-text-primary">{name}</h3>
          <p className="text-text-secondary mt-1">{email}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-text-primary">Full Name</label>
          <input
            type="text"
            readOnly
            value={name}
            className="w-full bg-bg-surface/50 border border-border rounded-lg px-4 py-2 text-text-primary cursor-not-allowed opacity-70"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-text-primary">Email Address</label>
          <input
            type="email"
            readOnly
            value={email}
            className="w-full bg-bg-surface/50 border border-border rounded-lg px-4 py-2 text-text-primary cursor-not-allowed opacity-70"
          />
        </div>

        <div className="pt-4 flex items-start gap-4">
          <div className="p-2 bg-accent/10 text-accent rounded-lg">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-text-primary">Managed by Keycloak</h4>
            <p className="text-xs text-text-secondary mt-1 max-w-md">
              Your profile information is securely managed by the central identity provider. 
              To change your name, email, or password, please visit the account portal.
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => window.open(accountUrl, "_blank")}
            >
              Manage Account <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
