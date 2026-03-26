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
    <GlassCard className="p-6">
      <p className="text-sm text-[var(--text-muted)] mb-1">{label}</p>
      <p
        className={cn(
          "text-3xl font-bold font-mono tracking-tight",
          scoreColor || "text-[var(--text-primary)]"
        )}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-[var(--text-secondary)] mt-1">{subtitle}</p>
      )}
    </GlassCard>
  );
}
