// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-semibold transition-all duration-[250ms] ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      primary: "btn-primary",
      secondary: "bg-bg-surface border border-border text-text-primary hover:bg-bg-hover hover:border-primary px-6 py-3 rounded-lg",
      danger: "bg-danger text-white hover:opacity-90 px-6 py-3 rounded-lg shadow-[0_0_15px_hsla(355,80%,60%,0.3)] hover:shadow-[0_0_20px_hsla(355,80%,60%,0.4)]",
      ghost: "btn-ghost",
      icon: "p-2 rounded-lg hover:bg-bg-glass text-text-secondary hover:text-text-primary border border-transparent hover:border-border",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(baseStyles, variants[variant], className)}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
