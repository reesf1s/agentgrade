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
    low:      "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.48)]",
    medium:   "border-[rgba(217,136,50,0.2)] bg-[rgba(217,136,50,0.1)] text-[#D98832]",
    high:     "border-[rgba(220,91,91,0.2)] bg-[rgba(220,91,91,0.1)] text-[#DC5B5B]",
    critical: "border-[rgba(220,91,91,0.28)] bg-[rgba(220,91,91,0.14)] text-[#DC5B5B]",
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
