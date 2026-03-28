"use client";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  hoverable?: boolean;
  onClick?: () => void;
}

export function GlassCard({
  children,
  className,
  elevated,
  hoverable = false,
  onClick,
}: GlassCardProps) {
  return (
    <div
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
    <GlassCard className="p-5">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={cn(
          "text-[2rem] font-semibold tracking-[-0.04em]",
          scoreColor || "text-[var(--text-primary)]"
        )}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-2 text-sm leading-5 text-[var(--text-secondary)]">{subtitle}</p>
      )}
    </GlassCard>
  );
}
