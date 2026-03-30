"use client";
import { cn } from "@/lib/utils";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function GlassButton({
  variant = "default",
  size = "md",
  children,
  className,
  ...props
}: GlassButtonProps) {
  const sizeClasses = {
    sm: "text-xs px-2.5 py-1.5",
    md: "text-sm px-3 py-1.5",
    lg: "text-sm px-4 py-2",
  };

  const variantClasses = {
    default: "glass-button",
    primary: "glass-button glass-button-primary",
    ghost:   "border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] rounded-md px-3 py-1.5 text-sm font-medium transition-all cursor-pointer",
  };

  return (
    <button
      className={cn(variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
