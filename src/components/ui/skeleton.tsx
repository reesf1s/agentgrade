import { cn } from "@/lib/utils";

// Base animated skeleton block
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse bg-[var(--surface-hover)] rounded-lg",
        className
      )}
    />
  );
}

// Stat card skeleton — matches StatCard layout
export function SkeletonStat() {
  return (
    <div className="glass-static p-6">
      <Skeleton className="h-3.5 w-28 mb-3" />
      <Skeleton className="h-9 w-24 mb-2" />
      <Skeleton className="h-3 w-36" />
    </div>
  );
}

// Table row skeleton
export function SkeletonRow({ cols = 6 }: { cols?: number }) {
  const widths = ["w-40", "w-20", "w-16", "w-12", "w-24", "w-20", "w-16"];
  return (
    <tr className="border-b border-[var(--divider)]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <Skeleton className={cn("h-4", widths[i % widths.length])} />
        </td>
      ))}
    </tr>
  );
}

// Full-page skeleton for glass cards
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass-static p-6 space-y-3", className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

// Dashboard skeleton — stat cards + chart + table
export function DashboardSkeleton() {
  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Chart */}
        <div className="col-span-2 glass-static p-6">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        {/* Alerts */}
        <div className="space-y-4">
          <div className="glass-static p-5">
            <Skeleton className="h-4 w-28 mb-4" />
            <Skeleton className="h-16 w-full rounded-xl mb-2" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-static mt-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--divider)]">
          <Skeleton className="h-4 w-40" />
        </div>
        <table className="w-full">
          <tbody>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </tbody>
        </table>
      </div>
    </div>
  );
}
