import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function scoreColor(score: number): string {
  if (score >= 0.7) return "score-good";
  if (score >= 0.4) return "score-warning";
  return "score-critical";
}

export function scoreBgColor(score: number): string {
  if (score >= 0.7) return "score-bg-good";
  if (score >= 0.4) return "score-bg-warning";
  return "score-bg-critical";
}

export function scoreLabel(score: number): string {
  if (score >= 0.8) return "Excellent";
  if (score >= 0.7) return "Good";
  if (score >= 0.5) return "Fair";
  if (score >= 0.3) return "Poor";
  return "Critical";
}

export function formatScore(score: number): string {
  return (score * 100).toFixed(0);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + "...";
}

/** Returns hex color for score: green/amber/red (Notion light palette) */
export function scoreAccent(score: number): string {
  if (score >= 0.75) return "#0F7B3D";
  if (score >= 0.55) return "#C47A00";
  return "#C4342C";
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
