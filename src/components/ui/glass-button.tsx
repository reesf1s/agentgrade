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
    sm:   "text-[12px] px-2.5 py-1.5 gap-1.5",
    md:   "text-[13px] px-3 py-1.5 gap-2",
    lg:   "text-[13px] px-4 py-2 gap-2",
    icon: "p-1.5",
  };

  const variantClasses = {
    default: "glass-button",
    primary: "glass-button glass-button-primary",
    ghost: [
      "inline-flex items-center justify-center",
      "border border-transparent bg-transparent",
      "text-[rgba(255,255,255,0.48)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgba(255,255,255,0.72)]",
      "rounded-md text-[13px] font-medium",
      "transition-all duration-100 cursor-pointer",
    ].join(" "),
    danger: [
      "glass-button",
      "border-[rgba(220,91,91,0.2)] text-[#DC5B5B]",
      "hover:bg-[rgba(220,91,91,0.08)] hover:border-[rgba(220,91,91,0.3)]",
    ].join(" "),
  };

  return (
    <button
      className={cn(variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      {children}
    </button>
  );
}
