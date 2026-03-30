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
        "relative overflow-hidden",
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
    <GlassCard className="p-5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
        {label}
      </p>
      <p
        className={cn(
          "text-[1.9rem] font-bold tracking-[-0.05em] font-mono tabular-nums",
          scoreColor || "text-fg"
        )}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-2 text-xs text-fg-secondary">{subtitle}</p>
      )}
    </GlassCard>
  );
}
