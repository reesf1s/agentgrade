import { cn } from "@/lib/utils";

/** Base skeleton block — uses CSS shimmer animation */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("skeleton rounded-lg", className)} />
  );
}

/** Stat card skeleton */
export function SkeletonStat() {
  return (
    <div className="glass-static relative p-4">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

/** Table row skeleton */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  const widths = ["w-32", "w-20", "w-16", "w-12"];
  return (
    <tr className="border-b border-edge">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <Skeleton className={cn("h-4", widths[i % widths.length])} />
        </td>
      ))}
    </tr>
  );
}

/** Card skeleton */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass-static relative p-5 space-y-3", className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

/** Full dashboard skeleton — responsive grid */
export function DashboardSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-52" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Main area */}
        <div className="glass-static relative p-5">
          <Skeleton className="h-4 w-36 mb-4" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        {/* Sidebar */}
        <div className="space-y-3">
          <div className="glass-static relative p-4">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
          <div className="glass-static relative p-4">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
