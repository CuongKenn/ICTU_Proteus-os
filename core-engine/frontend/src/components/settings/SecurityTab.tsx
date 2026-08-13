"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { Shield, Key, Smartphone, Clock } from "lucide-react";

export const SecurityTab = () => {
  const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://auth.proteus.local";
  const securityUrl = `${keycloakUrl}/realms/proteus/account/password`;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Security Settings</h2>
        <p className="text-text-secondary text-sm mt-1">
          Manage your account security, passwords, and active sessions.
        </p>
      </div>

      <div className="grid gap-6">
        <div className="p-5 border border-border bg-bg-surface/50 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-lg">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Password</h3>
              <p className="text-sm text-text-secondary mt-1">
                Change your password regularly to keep your account secure.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => window.open(securityUrl, "_blank")}>
            Change Password
          </Button>
        </div>

        <div className="p-5 border border-border bg-bg-surface/50 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-success/10 text-success rounded-lg">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Two-Factor Authentication</h3>
              <p className="text-sm text-text-secondary mt-1">
                Add an extra layer of security to your account.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => window.open(keycloakUrl + "/realms/proteus/account/", "_blank")}>
            Setup 2FA
          </Button>
        </div>

        <div className="pt-4 border-t border-border">
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Active Sessions
          </h3>
          <div className="text-sm text-text-secondary p-4 bg-bg-surface rounded-lg border border-dashed border-border flex items-center justify-center">
            Session management is handled by Keycloak. 
            <a 
              href={keycloakUrl + "/realms/proteus/account/sessions"} 
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline ml-1"
            >
              View active sessions
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
