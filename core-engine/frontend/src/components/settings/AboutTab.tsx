"use client";

import React, { useEffect, useState } from "react";
import { Info, Server, CheckCircle2, XCircle } from "lucide-react";
import { clsx } from "clsx";

interface ServiceHealth {
  name: string;
  status: "healthy" | "unhealthy" | "checking";
}

export const AboutTab = () => {
  const [services, setServices] = useState<ServiceHealth[]>([
    { name: "Frontend (Next.js)", status: "checking" },
    { name: "Backend (FastAPI)", status: "checking" },
  ]);

  useEffect(() => {
    // Check Frontend
    setServices((prev) =>
      prev.map((s) => (s.name === "Frontend (Next.js)" ? { ...s, status: "healthy" } : s))
    );

    // Check Backend
    fetch("/api/v1/health")
      .then((res) => {
        setServices((prev) =>
          prev.map((s) =>
            s.name === "Backend (FastAPI)"
              ? { ...s, status: res.ok ? "healthy" : "unhealthy" }
              : s
          )
        );
      })
      .catch(() => {
        setServices((prev) =>
          prev.map((s) => (s.name === "Backend (FastAPI)" ? { ...s, status: "unhealthy" } : s))
        );
      });
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-text-primary">About Proteus OS</h2>
        <p className="text-text-secondary text-sm mt-1">
          System information, version details, and service status.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center p-8 border border-border bg-bg-surface/50 rounded-xl text-center">
        <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4 border border-primary/30">
          <span className="text-primary font-black text-3xl">P</span>
        </div>
        <h3 className="text-2xl font-bold text-text-primary">Proteus OS</h3>
        <span className="inline-block mt-2 px-3 py-1 bg-accent/10 text-accent text-sm font-semibold rounded-full">
          v0.1.0-alpha
        </span>
        <p className="mt-4 text-text-secondary max-w-md text-sm">
          An open-source AI-native Operating System. Built with Next.js, FastAPI, and integrated with Mattermost, n8n, and Keycloak.
        </p>
        <a 
          href="https://github.com/CuongKenn/ICTU_Proteus-os" 
          target="_blank" 
          rel="noreferrer"
          className="text-primary text-sm hover:underline mt-4 font-medium"
        >
          View Source Code
        </a>
      </div>

      <div className="pt-4">
        <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Server className="w-4 h-4" /> System Services Status
        </h3>
        <div className="grid gap-3">
          {services.map((service) => (
            <div 
              key={service.name}
              className="flex items-center justify-between p-3 border border-border rounded-lg bg-bg-surface"
            >
              <span className="text-sm font-medium text-text-primary">{service.name}</span>
              <div className="flex items-center gap-2">
                {service.status === "checking" && (
                  <span className="text-xs text-text-secondary animate-pulse">Checking...</span>
                )}
                {service.status === "healthy" && (
                  <div className="flex items-center gap-1.5 text-success">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-semibold">Operational</span>
                  </div>
                )}
                {service.status === "unhealthy" && (
                  <div className="flex items-center gap-1.5 text-danger">
                    <XCircle className="w-4 h-4" />
                    <span className="text-xs font-semibold">Down</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="pt-4 border-t border-border">
        <h3 className="text-sm font-medium text-text-primary mb-2">License</h3>
        <p className="text-xs text-text-secondary">
          Proteus OS is licensed under the <strong>AGPL-3.0-or-later</strong> license.
          <br/>
          Copyright © 2026 CuongKenn & ICTU Team.
        </p>
      </div>
    </div>
  );
};
