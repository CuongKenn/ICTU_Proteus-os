// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "accent";
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "accent",
  isLoading = false,
  children,
  className,
  disabled,
  ...props
}) => {
  const variantClass = {
    accent: "btn-accent",
    primary: "btn-primary",
    secondary: "btn-ghost",
    danger: "btn-danger",
    ghost: "btn-ghost",
  }[variant];

  return (
    <button
      className={clsx(variantClass, className)}
      disabled={disabled || isLoading}
      style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
};
