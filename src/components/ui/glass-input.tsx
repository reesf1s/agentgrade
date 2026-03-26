"use client";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "glass-input w-full px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
            error && "border-red-300",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-score-critical">{error}</p>}
      </div>
    );
  }
);
GlassInput.displayName = "GlassInput";

interface GlassTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function GlassTextarea({ label, className, ...props }: GlassTextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <textarea
        className={cn(
          "glass-input w-full px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] min-h-[100px] resize-y",
          className
        )}
        {...props}
      />
    </div>
  );
}

interface GlassSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function GlassSelect({
  label,
  options,
  className,
  ...props
}: GlassSelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <select
        className={cn(
          "glass-input w-full px-4 py-2.5 text-sm text-[var(--text-primary)]",
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
