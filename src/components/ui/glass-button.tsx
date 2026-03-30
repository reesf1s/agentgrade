"use client";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  children: React.ReactNode;
}

export function GlassButton({
  variant = "default",
  size = "md",
  loading = false,
  children,
  className,
  disabled,
  ...props
}: GlassButtonProps) {
  const sizeClasses = {
    sm: "text-xs px-2.5 py-1.5 gap-1.5",
    md: "text-sm px-3.5 py-2 gap-2",
    lg: "text-sm px-5 py-2.5 gap-2",
    icon: "p-2",
  };

  const variantClasses = {
    default: "glass-button",
    primary: "glass-button glass-button-primary",
    ghost: [
      "inline-flex items-center justify-center",
      "border border-transparent bg-transparent",
      "text-fg-secondary hover:bg-surface-hover hover:text-fg",
      "rounded-lg text-sm font-medium",
      "transition-all duration-150 cursor-pointer",
      "focus-visible:shadow-[var(--focus-ring)]",
    ].join(" "),
    danger: [
      "glass-button",
      "border-[rgba(239,68,68,0.20)] text-[#EF4444]",
      "hover:bg-[rgba(239,68,68,0.08)] hover:border-[rgba(239,68,68,0.30)]",
    ].join(" "),
  };

  return (
    <button
      className={cn(variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}
