"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, BookOpen, Brain, Check, RefreshCw } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassCard } from "@/components/ui/glass-card";
import { SeverityBadge } from "@/components/ui/score-badge";
import type { FailurePattern } from "@/lib/db/types";

export function PatternsPageClient({ initialPatterns }: { initialPatterns: FailurePattern[] }) {
  const [patterns, setPatterns] = useState(initialPatterns);
  const [resolving, setResolving] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function resolvePattern(patternId: string) {
    setResolving(patternId);
    try {
      const response = await fetch(`/api/patterns/${patternId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_resolved: true }),
      });

      if (response.ok) {
        setPatterns((current) => current.filter((pattern) => pattern.id !== patternId));
      }
    } finally {
      setResolving(null);
    }
  }

  async function refreshPatterns() {
    setRefreshing(true);
    try {
      await fetch("/api/patterns", { method: "POST" });
      window.location.reload();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <GlassCard className="rounded-[1.35rem] p-6 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="enterprise-kicker">Issues</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[var(--text-primary)]">
              Turn repeated failures into one clear fix.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Similar breakdowns are grouped into operating issues so you can fix the root cause once instead of chasing one conversation at a time.
            </p>
          </div>
          <GlassButton onClick={refreshPatterns} disabled={refreshing} className="inline-flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing issues..." : "Refresh issues"}
          </GlassButton>
        </div>
      </GlassCard>

      {patterns.length === 0 ? (
        <GlassCard className="rounded-[1.25rem] p-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No recurring issue is standing out yet. Once enough scored conversations land, AgentGrade will group repeated failures here.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {patterns.map((pattern) => (
            <GlassCard key={pattern.id} className="rounded-[1.25rem] p-5">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                <div>
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            pattern.severity === "critical"
                              ? "score-bg-critical"
                              : pattern.severity === "high"
                                ? "score-bg-warning"
                                : "bg-[var(--surface)]"
                          }`}
                        >
                          <AlertTriangle
                            className={`h-4 w-4 ${
                              pattern.severity === "critical"
                                ? "score-critical"
                                : pattern.severity === "high"
                                  ? "score-warning"
                                  : "text-[var(--text-secondary)]"
                            }`}
                          />
                        </div>
                        <div>
                          <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                            {pattern.title}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <SeverityBadge severity={pattern.severity} />
                            <span className="text-xs text-[var(--text-muted)]">
                              Seen across {pattern.affected_conversation_ids.length} conversations
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <GlassButton
                      size="sm"
                      onClick={() => resolvePattern(pattern.id)}
                      disabled={resolving === pattern.id}
                      className="inline-flex items-center gap-2"
                    >
                      <Check className="h-4 w-4" />
                      {resolving === pattern.id ? "Resolving..." : "Mark resolved"}
                    </GlassButton>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        What is happening
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{pattern.description}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Best next fix
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                        {pattern.recommendation || pattern.prompt_fix || pattern.knowledge_base_suggestion || "Review this issue and decide whether the fix belongs in prompting, workflow, or documentation."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {pattern.prompt_fix ? (
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Brain className="h-4 w-4 text-[var(--text-secondary)]" />
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Prompt change</p>
                      </div>
                      <p className="text-sm leading-6 text-[var(--text-secondary)]">{pattern.prompt_fix}</p>
                    </div>
                  ) : null}

                  {pattern.knowledge_base_suggestion ? (
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-[var(--text-secondary)]" />
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Knowledge update</p>
                      </div>
                      <p className="text-sm leading-6 text-[var(--text-secondary)]">
                        {pattern.knowledge_base_suggestion}
                      </p>
                    </div>
                  ) : null}

                  {pattern.affected_conversation_ids.length > 0 ? (
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Example conversations</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {pattern.affected_conversation_ids.slice(0, 6).map((conversationId) => (
                          <Link
                            key={conversationId}
                            href={`/conversations/${conversationId}`}
                            className="rounded-full border border-[var(--border-subtle)] bg-[var(--panel)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]"
                          >
                            {conversationId.slice(0, 8)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
