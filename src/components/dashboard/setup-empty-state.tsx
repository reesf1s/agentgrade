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
  hint = "Connect a source first, then AgentGrade can start scoring conversations, spotting repeat issues, and building weekly reports for the workspace.",
}: SetupEmptyStateProps) {
  return (
    <div className="pb-10">
      <GlassCard className="rounded-[1.35rem] p-8 md:p-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)]">
            <Bot className="h-5 w-5 text-[var(--text-primary)]" />
          </div>
          <div>
            <p className="enterprise-kicker">Setup required</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              {title}
            </h1>
          </div>
        </div>

        <p className="max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">{description}</p>

        <div className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--text-secondary)]">
          <div className="mb-2 flex items-center gap-2 text-[var(--text-primary)]">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">What happens next</span>
          </div>
          <p>{hint}</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/onboarding" className="glass-button glass-button-primary inline-flex items-center gap-2">
            Connect a source <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/settings" className="glass-button inline-flex items-center gap-2">
            Open setup
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
