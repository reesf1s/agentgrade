"use client";
import { useParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { ScoreBadge, SeverityBadge } from "@/components/ui/score-badge";
import { GlassButton } from "@/components/ui/glass-button";
import { scoreColor, formatScore } from "@/lib/utils";
import { SEED_CONVERSATIONS } from "@/lib/db/seed-data";
import { ArrowLeft, AlertTriangle, Brain, BookOpen, User, Bot, Headphones } from "lucide-react";
import Link from "next/link";

export default function ConversationDetailPage() {
  const params = useParams();
  const conv = SEED_CONVERSATIONS.find((c) => c.id === params.id);

  if (!conv) {
    return (
      <div className="max-w-4xl">
        <Link href="/conversations" className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to conversations
        </Link>
        <GlassCard className="p-12 text-center">
          <p className="text-[var(--text-muted)]">Conversation not found</p>
        </GlassCard>
      </div>
    );
  }

  const qs = conv.quality_score;

  const roleConfig = {
    customer: { icon: User, label: "Customer", bg: "bg-white/5", align: "mr-auto" },
    agent: { icon: Bot, label: "AI Agent", bg: "bg-white/[0.07]", align: "ml-auto" },
    human_agent: { icon: Headphones, label: "Human Agent", bg: "bg-[rgba(59,130,246,0.05)]", align: "ml-auto" },
    system: { icon: Bot, label: "System", bg: "bg-white/5", align: "mx-auto" },
  };

  return (
    <div className="max-w-6xl">
      <Link href="/conversations" className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to conversations
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{conv.customer_identifier}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {conv.platform} &middot; {conv.message_count} messages
            {conv.was_escalated && " \u00b7 Escalated"}
          </p>
        </div>
        <ScoreBadge score={qs.overall_score} size="lg" label="overall" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Conversation Transcript */}
        <div className="col-span-2 space-y-4">
          <GlassCard className="p-6">
            <h2 className="text-sm font-medium text-[var(--text-primary)] mb-5">Conversation</h2>
            <div className="space-y-4">
              {conv.messages.map((msg) => {
                const config = roleConfig[msg.role];
                const Icon = config.icon;
                // Check if this message contains a flagged claim
                const flaggedClaims = qs.claim_analysis.filter(
                  (ca) => ca.verdict !== "verified" && msg.content.toLowerCase().includes(ca.claim.toLowerCase().slice(0, 20))
                );

                return (
                  <div key={msg.id} className={`flex ${config.align === "ml-auto" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] ${config.bg} rounded-2xl p-4`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span className="text-xs font-medium text-[var(--text-muted)]">{config.label}</span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed">{msg.content}</p>

                      {/* Inline annotations for flagged claims */}
                      {flaggedClaims.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {flaggedClaims.map((claim, i) => (
                            <div
                              key={i}
                              className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                                claim.verdict === "fabricated"
                                  ? "score-bg-critical"
                                  : "score-bg-warning"
                              }`}
                            >
                              <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                                claim.verdict === "fabricated" ? "score-critical" : "score-warning"
                              }`} />
                              <div>
                                <span className={`font-medium capitalize ${
                                  claim.verdict === "fabricated" ? "score-critical" : "score-warning"
                                }`}>
                                  {claim.verdict}:
                                </span>{" "}
                                <span className="text-[var(--text-secondary)]">{claim.evidence}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Prompt Improvements */}
          {qs.prompt_improvements.length > 0 && (
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-[var(--text-secondary)]" />
                <h2 className="text-sm font-medium text-[var(--text-primary)]">Recommended Prompt Improvements</h2>
              </div>
              <div className="space-y-4">
                {qs.prompt_improvements.map((imp, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{imp.issue}</p>
                      <SeverityBadge severity={imp.priority === "high" ? "high" : imp.priority === "medium" ? "medium" : "low"} />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mb-3">
                      <strong>Current behavior:</strong> {imp.current_behavior}
                    </p>
                    <div className="p-3 rounded-lg bg-white/5 font-mono text-xs text-[var(--text-primary)] leading-relaxed">
                      {imp.recommended_prompt_change}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      Expected impact: {imp.expected_impact}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Knowledge Gaps */}
          {qs.knowledge_gaps.length > 0 && (
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-[var(--text-secondary)]" />
                <h2 className="text-sm font-medium text-[var(--text-primary)]">Knowledge Base Gaps</h2>
              </div>
              <div className="space-y-3">
                {qs.knowledge_gaps.map((gap, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/5">
                    <p className="text-sm font-medium text-[var(--text-primary)] capitalize mb-1">{gap.topic}</p>
                    <p className="text-xs text-[var(--text-secondary)] mb-2">{gap.description}</p>
                    <p className="text-xs text-[var(--text-muted)]">Suggested content: {gap.suggested_content}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Score Sidebar */}
        <div className="space-y-4">
          <GlassCard className="p-5">
            <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">Quality Scores</h2>
            <div className="space-y-4">
              {[
                { label: "Overall", score: qs.overall_score },
                { label: "Accuracy", score: qs.accuracy_score },
                { label: "Hallucination", score: qs.hallucination_score },
                { label: "Resolution", score: qs.resolution_score },
                { label: "Tone", score: qs.tone_score },
                { label: "Sentiment", score: qs.sentiment_score },
              ].map(({ label, score }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                    <span className={`text-sm font-mono font-semibold ${scoreColor(score || 0)}`}>
                      {formatScore(score || 0)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.07]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (score || 0) >= 0.7
                          ? "bg-score-good"
                          : (score || 0) >= 0.4
                          ? "bg-score-warning"
                          : "bg-score-critical"
                      }`}
                      style={{ width: `${(score || 0) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Summary */}
          <GlassCard className="p-5">
            <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">Summary</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{qs.summary}</p>
          </GlassCard>

          {/* Flags */}
          {qs.flags.length > 0 && (
            <GlassCard className="p-5">
              <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">Flags</h2>
              <div className="flex flex-wrap gap-2">
                {qs.flags.map((flag, i) => (
                  <span
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-full bg-[rgba(239,68,68,0.08)] text-[#EF4444] font-medium"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Claim Analysis */}
          {qs.claim_analysis.length > 0 && (
            <GlassCard className="p-5">
              <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">Claim Verification</h2>
              <div className="space-y-2.5">
                {qs.claim_analysis.map((ca, i) => {
                  const verdictColor = {
                    verified: "score-good",
                    unverifiable: "text-[var(--text-muted)]",
                    contradicted: "score-warning",
                    fabricated: "score-critical",
                  }[ca.verdict];
                  return (
                    <div key={i} className="p-2.5 rounded-lg bg-white/5">
                      <p className="text-xs text-[var(--text-primary)] mb-1">{ca.claim}</p>
                      <span className={`text-xs font-medium capitalize ${verdictColor}`}>
                        {ca.verdict}
                      </span>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}

          {/* Override */}
          <GlassCard className="p-5">
            <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">Override Score</h2>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Disagree with the assessment? Override a score to calibrate the model.
            </p>
            <GlassButton size="sm" className="w-full">Submit Override</GlassButton>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
