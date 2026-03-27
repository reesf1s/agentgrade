"use client";

import Link from "next/link";
import { ArrowRight, Bot, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

interface SetupEmptyStateProps {
  title: string;
  description: string;
  hint?: string;
}

export function SetupEmptyState({
  title,
  description,
  hint = "You can connect multiple bots in one workspace. Each bot gets its own secure webhook and scoring history.",
}: SetupEmptyStateProps) {
  return (
    <div className="max-w-4xl">
      <GlassCard className="glass-highlight rounded-[1.25rem] p-8 md:p-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <Bot className="h-5 w-5 text-[var(--text-primary)]" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--text-muted)]">
              Setup required
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              {title}
            </h1>
          </div>
        </div>

        <p className="max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
          {description}
        </p>

        <div className="mt-6 rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 text-sm text-[var(--text-secondary)]">
          <div className="mb-2 flex items-center gap-2 text-[var(--text-primary)]">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">What happens next</span>
          </div>
          <p>{hint}</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/onboarding" className="glass-button glass-button-primary inline-flex items-center gap-2">
            Connect a bot <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/settings" className="glass-button inline-flex items-center gap-2">
            Open settings
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
