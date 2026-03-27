"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, BookOpen, Brain, Check } from "lucide-react";
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
    <div className="max-w-5xl">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Failure Patterns</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Detected issues across your AI agent conversations
          </p>
        </div>
        <GlassButton onClick={refreshPatterns} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh analysis"}
        </GlassButton>
      </div>

      {patterns.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No failure patterns detected yet. Patterns emerge after scoring multiple conversations.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {patterns.map((pattern) => (
            <GlassCard key={pattern.id} className="p-6">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      pattern.severity === "critical"
                        ? "score-bg-critical"
                        : pattern.severity === "high"
                          ? "score-bg-warning"
                          : "bg-[rgba(0,0,0,0.04)]"
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
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{pattern.title}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <SeverityBadge severity={pattern.severity} />
                      <span className="text-xs text-[var(--text-muted)]">
                        {pattern.affected_conversation_ids.length} conversations affected
                      </span>
                    </div>
                  </div>
                </div>
                <GlassButton
                  size="sm"
                  className="flex items-center gap-1.5"
                  onClick={() => resolvePattern(pattern.id)}
                  disabled={resolving === pattern.id}
                >
                  <Check className="h-3.5 w-3.5" />
                  {resolving === pattern.id ? "Resolving..." : "Resolve"}
                </GlassButton>
              </div>

              <p className="mb-4 text-sm leading-relaxed text-[var(--text-secondary)]">{pattern.description}</p>

              {pattern.affected_conversation_ids.length > 0 && (
                <div className="mb-3 rounded-xl bg-[rgba(0,0,0,0.02)] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="text-xs font-medium text-[var(--text-primary)]">Affected conversations</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pattern.affected_conversation_ids.slice(0, 6).map((conversationId) => (
                      <Link
                        key={conversationId}
                        href={`/conversations/${conversationId}`}
                        className="rounded-full bg-white px-3 py-1 text-xs text-[var(--text-primary)] shadow-sm transition-colors hover:bg-[rgba(0,0,0,0.04)]"
                      >
                        {conversationId.slice(0, 8)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {pattern.prompt_fix && (
                <div className="mb-3 rounded-xl bg-[rgba(0,0,0,0.02)] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Brain className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="text-xs font-medium text-[var(--text-primary)]">Recommended Prompt Fix</span>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{pattern.prompt_fix}</p>
                </div>
              )}

              {pattern.knowledge_base_suggestion && (
                <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="text-xs font-medium text-[var(--text-primary)]">Knowledge Base Suggestion</span>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                    {pattern.knowledge_base_suggestion}
                  </p>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
