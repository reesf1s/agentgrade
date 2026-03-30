import { cn, scoreColor, scoreBgColor, formatScore } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, label, size = "md" }: ScoreBadgeProps) {
  const sizeClasses = {
    sm: "text-[11px] px-1.5 py-0.5",
    md: "text-xs px-2 py-0.5",
    lg: "text-sm px-2.5 py-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-bold tabular-nums font-mono border transition-colors",
        scoreBgColor(score),
        scoreColor(score),
        sizeClasses[size]
      )}
    >
      {formatScore(score)}%
      {label && <span className="opacity-70 font-normal">{label}</span>}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: "low" | "medium" | "high" | "critical";
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const styles: Record<string, string> = {
    low:      "border-edge bg-surface text-fg-muted",
    medium:   "border-[rgba(245,158,11,0.20)] bg-[rgba(245,158,11,0.10)] text-score-warning",
    high:     "border-[rgba(239,68,68,0.20)] bg-[rgba(239,68,68,0.10)] text-score-critical",
    critical: "border-[rgba(239,68,68,0.30)] bg-[rgba(239,68,68,0.15)] text-score-critical",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize border",
        styles[severity] || styles.low
      )}
    >
      {severity}
    </span>
  );
}
