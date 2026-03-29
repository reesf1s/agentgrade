"use client";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  hoverable?: boolean;
}

export function GlassCard({
  children,
  className,
  elevated,
  hoverable = false,
  onClick,
  ...props
}: GlassCardProps) {
  return (
    <div
      {...props}
      onClick={onClick}
      className={cn(
        elevated ? "glass-elevated" : hoverable ? "glass" : "glass-static",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  scoreColor?: string;
}

export function StatCard({ label, value, subtitle, scoreColor }: StatCardProps) {
  return (
    <GlassCard className="rounded-[1rem] p-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={cn(
          "text-[1.85rem] font-semibold tracking-[-0.04em]",
          scoreColor || "text-[var(--text-primary)]"
        )}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-1.5 text-sm leading-5 text-[var(--text-secondary)]">{subtitle}</p>
      )}
    </GlassCard>
  );
}
