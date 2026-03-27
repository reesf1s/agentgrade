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
  // Use CSS-variable-aware styles that work in both light and dark mode
  const styles = {
    low:      "bg-[rgba(156,163,175,0.12)] text-[rgba(156,163,175,0.9)]",
    medium:   "score-bg-warning score-warning",
    high:     "bg-[rgba(249,115,22,0.12)] text-[#F97316]",
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
