"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, RefreshCw } from "lucide-react";
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
      <section className="glass-static rounded-[1.5rem] p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="page-eyebrow">Issues</p>
            <h1 className="mt-2 page-title">Repeated problems, grouped into one fixable list.</h1>
            <p className="mt-3 page-subtitle">
              This page should only surface repeated issues that are clear enough to matter and actionable enough to fix.
            </p>
          </div>
          <GlassButton onClick={refreshPatterns} disabled={refreshing} className="inline-flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh issues"}
          </GlassButton>
        </div>
      </section>

      {patterns.length === 0 ? (
        <GlassCard className="rounded-[1.4rem] p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No repeated issue is standing out yet. Once enough usable scored conversations land, AgentGrade will group them here.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {patterns.map((pattern) => (
            <GlassCard key={pattern.id} className="rounded-[1.4rem] p-5 sm:p-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                <div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            pattern.severity === "critical"
                              ? "score-bg-critical"
                              : pattern.severity === "high"
                                ? "score-bg-warning"
                                : "bg-[var(--surface-soft)]"
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
                          <p className="text-lg font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                            {pattern.title}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <SeverityBadge severity={pattern.severity} />
                            <span className="operator-chip">
                              {pattern.affected_conversation_ids.length} conversations
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

                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    <div className="metric-card px-4 py-4">
                      <p className="section-label">What is happening</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{pattern.description}</p>
                    </div>
                    <div className="metric-card px-4 py-4">
                      <p className="section-label">What to do next</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                        {pattern.recommendation || pattern.prompt_fix || pattern.knowledge_base_suggestion || "Review this issue and decide whether the fix belongs in workflow, prompting, or coverage."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {pattern.prompt_fix ? (
                    <div className="metric-card px-4 py-4">
                      <p className="section-label">Prompt change</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{pattern.prompt_fix}</p>
                    </div>
                  ) : null}

                  {pattern.knowledge_base_suggestion ? (
                    <div className="metric-card px-4 py-4">
                      <p className="section-label">Knowledge update</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{pattern.knowledge_base_suggestion}</p>
                    </div>
                  ) : null}

                  {pattern.affected_conversation_ids.length > 0 ? (
                    <div className="metric-card px-4 py-4">
                      <p className="section-label">Examples</p>
                      <div className="mt-3 space-y-2">
                        {pattern.affected_conversation_ids.slice(0, 4).map((conversationId) => (
                          <Link
                            key={conversationId}
                            href={`/conversations/${conversationId}`}
                            className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text-primary)]"
                          >
                            <span>{conversationId.slice(0, 8)}</span>
                            <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" />
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
