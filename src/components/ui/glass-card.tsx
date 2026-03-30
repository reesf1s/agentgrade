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
        "relative",
        elevated ? "glass-elevated" : hoverable ? "glass" : "glass-static",
        onClick && "cursor-pointer",
        "overflow-hidden",
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
    <GlassCard className="p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
        {label}
      </p>
      <p
        className={cn(
          "text-2xl font-bold tracking-[-0.03em] font-mono tabular-nums",
          scoreColor || "text-fg"
        )}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-1.5 text-xs text-fg-secondary">{subtitle}</p>
      )}
    </GlassCard>
  );
}
