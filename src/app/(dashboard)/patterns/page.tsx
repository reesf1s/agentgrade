"use client";
import { GlassCard } from "@/components/ui/glass-card";
import { SeverityBadge } from "@/components/ui/score-badge";
import { GlassButton } from "@/components/ui/glass-button";
import { SEED_PATTERNS } from "@/lib/db/seed-data";
import { AlertTriangle, Brain, BookOpen, Check } from "lucide-react";

export default function PatternsPage() {
  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Failure Patterns</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Detected issues across your AI agent conversations
        </p>
      </div>

      <div className="space-y-4">
        {SEED_PATTERNS.map((pattern) => (
          <GlassCard key={pattern.id} className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  pattern.severity === "critical" ? "score-bg-critical" : pattern.severity === "high" ? "score-bg-warning" : "bg-white/[0.07]"
                }`}>
                  <AlertTriangle className={`w-4 h-4 ${
                    pattern.severity === "critical" ? "score-critical" : pattern.severity === "high" ? "score-warning" : "text-[var(--text-secondary)]"
                  }`} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{pattern.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <SeverityBadge severity={pattern.severity} />
                    <span className="text-xs text-[var(--text-muted)]">
                      {pattern.affected_conversation_ids.length} conversations affected
                    </span>
                  </div>
                </div>
              </div>
              <GlassButton size="sm" className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Resolve
              </GlassButton>
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
              {pattern.description}
            </p>

            {pattern.prompt_fix && (
              <div className="p-4 rounded-xl bg-white/5 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  <span className="text-xs font-medium text-[var(--text-primary)]">Recommended Prompt Fix</span>
                </div>
                <p className="text-xs font-mono text-[var(--text-secondary)] leading-relaxed">
                  {pattern.prompt_fix}
                </p>
              </div>
            )}

            {pattern.knowledge_base_suggestion && (
              <div className="p-4 rounded-xl bg-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  <span className="text-xs font-medium text-[var(--text-primary)]">Knowledge Base Suggestion</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {pattern.knowledge_base_suggestion}
                </p>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
