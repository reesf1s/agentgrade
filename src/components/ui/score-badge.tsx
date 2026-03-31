import { cn, scoreColor, scoreBgColor, formatScore } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, label, size = "md" }: ScoreBadgeProps) {
  const sizeClasses = {
    sm: "text-[11px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-0.5 gap-1",
    lg: "text-[13px] px-2.5 py-1 gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded font-semibold tabular-nums font-mono border",
        scoreBgColor(score),
        scoreColor(score),
        sizeClasses[size]
      )}
    >
      {formatScore(score)}%
      {label && <span className="opacity-60 font-normal">{label}</span>}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: "low" | "medium" | "high" | "critical";
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const styles: Record<string, string> = {
    low:      "border-[#E9E9E7] bg-[#F7F7F5] text-[#787774]",
    medium:   "border-[rgba(196,122,0,0.2)] bg-[rgba(196,122,0,0.08)] text-[#C47A00]",
    high:     "border-[rgba(196,52,44,0.2)] bg-[rgba(196,52,44,0.08)] text-[#C4342C]",
    critical: "border-[rgba(196,52,44,0.3)] bg-[rgba(196,52,44,0.12)] text-[#C4342C]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium capitalize border",
        styles[severity] || styles.low
      )}
    >
      {severity}
    </span>
  );
}
