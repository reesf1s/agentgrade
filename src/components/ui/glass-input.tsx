"use client";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

const labelClasses = "block text-[11px] font-semibold tracking-[0.01em] text-fg-secondary";

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && <label className={labelClasses}>{label}</label>}
        <input
          ref={ref}
          className={cn(
            "glass-input w-full px-3.5 py-2 text-sm",
            error && "border-score-critical/40 focus:border-score-critical",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-score-critical mt-1">{error}</p>}
      </div>
    );
  }
);
GlassInput.displayName = "GlassInput";

interface GlassTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function GlassTextarea({ label, error, className, ...props }: GlassTextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className={labelClasses}>{label}</label>}
      <textarea
        className={cn(
          "glass-input w-full px-3.5 py-2 text-sm min-h-[100px] resize-y",
          error && "border-score-critical/40 focus:border-score-critical",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-score-critical mt-1">{error}</p>}
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
      {label && <label className={labelClasses}>{label}</label>}
      <select
        className={cn(
          "glass-input w-full px-3.5 py-2 text-sm",
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
