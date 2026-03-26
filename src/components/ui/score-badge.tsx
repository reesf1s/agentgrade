"use client";
import { cn, scoreColor, scoreBgColor, formatScore } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, label, size = "md" }: ScoreBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5 font-semibold",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-mono",
        scoreBgColor(score),
        scoreColor(score),
        sizeClasses[size]
      )}
    >
      {formatScore(score)}
      {label && <span className="font-sans text-[0.85em] opacity-70">{label}</span>}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: "low" | "medium" | "high" | "critical";
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const styles = {
    low: "bg-gray-100 text-gray-600",
    medium: "score-bg-warning score-warning",
    high: "bg-orange-100 text-orange-700",
    critical: "score-bg-critical score-critical",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[severity]
      )}
    >
      {severity}
    </span>
  );
}
