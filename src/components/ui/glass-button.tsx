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
    sm: "text-sm px-3 py-1.5 rounded-lg",
    md: "text-sm px-5 py-2.5 rounded-xl",
    lg: "text-base px-6 py-3 rounded-xl",
  };

  const variantClasses = {
    default: "glass-button",
    primary: "glass-button glass-button-primary",
    ghost:
      "bg-transparent border border-transparent hover:bg-[rgba(0,0,0,0.03)] rounded-xl px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer",
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
