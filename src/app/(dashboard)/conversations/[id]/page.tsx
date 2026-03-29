"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Headphones,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassSelect, GlassTextarea } from "@/components/ui/glass-input";
import { ScoreBadge } from "@/components/ui/score-badge";
import { scoreColor, formatScore } from "@/lib/utils";
import type { ClaimAnalysis, Message, QualityScore } from "@/lib/db/types";
import { isGroundingRiskOnlyScore } from "@/lib/scoring/quality-score-status";
import {
  getConversationDispositionMap,
  setConversationDisposition,
  setQueueState,
  type ReviewDisposition,
} from "@/lib/review-workflow";

interface ConversationDetail {
  id: string;
  customer_identifier?: string;
  platform: string;
  message_count: number;
  was_escalated: boolean;
  created_at: string;
  messages: Message[];
  quality_score: QualityScore | null;
  score_status?: "pending" | "refreshing" | "ready" | "waiting_for_completion" | "waiting_for_quiet_period";
}

interface ReviewGroup {
  title: string;
  body: string;
}

function hasStructuredAnswer(messages: Message[]) {
  return messages.some(
    (message) =>
      message.role === "agent" &&
      (/##|###|\|/.test(message.content) ||
        /priority|next step|what to do next|snapshot|risk|todo|summary|briefing/i.test(message.content))
  );
}

function deriveStrengths(messages: Message[], score?: QualityScore | null) {
  const strengths: string[] = [];

  if ((score?.resolution_score || 0) >= 0.78) {
    strengths.push("The answer moved the user toward a clear next step.");
  }
  if ((score?.tone_score || 0) >= 0.84) {
    strengths.push("The tone stayed calm, professional, and easy to trust.");
  }
  if (hasStructuredAnswer(messages)) {
    strengths.push("The response was easy to scan and would work well as a working brief.");
  }
  if ((score?.overall_score || 0) >= 0.8) {
    strengths.push("This is strong enough to treat as a repeatable response pattern.");
  }

  return strengths.slice(0, 3);
}

function claimLooksLikeDate(text: string) {
  return /\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|deadline|due|close date|week|month|quarter|day)\b/i.test(
    text
  );
}

function claimLooksLikeNumber(text: string) {
  return /[%£$€]|\b\d+(\.\d+)?\b|score|probability|value|hours|rate|metric|accuracy|conversion|win rate|amount/i.test(
    text
  );
}

function claimLooksLikeRecord(text: string) {
  return /\b(deal|account|company|contact|ticket|subscription|order|record|crm|pipeline|stage|owner|champion|todo|history|health|risk|briefing|competitor)\b/i.test(
    text
  );
}

function buildReviewGroups(score?: QualityScore | null): ReviewGroup[] {
  const claims = (score?.claim_analysis || []).filter((claim) => claim.verdict !== "verified");
  if (claims.length === 0) {
    return [];
  }

  const groups: ReviewGroup[] = [];

  if (claims.some((claim) => claimLooksLikeRecord(claim.claim))) {
    groups.push({
      title: "Record details",
      body: "Deal fields, contact roles, or internal record details should be checked against the source system before reuse.",
    });
  }

  if (claims.some((claim) => claimLooksLikeNumber(claim.claim))) {
    groups.push({
      title: "Numbers and scores",
      body: "Metrics, values, probabilities, or score changes were stated confidently and should be spot-checked before anyone acts on them.",
    });
  }

  if (claims.some((claim) => claimLooksLikeDate(claim.claim))) {
    groups.push({
      title: "Dates and timing",
      body: "Dates, deadlines, and overdue status should be checked before they are used in planning or follow-up.",
    });
  }

  if (groups.length === 0) {
    groups.push({
      title: "Specific details",
      body: "A few specific claims are not fully traceable in the transcript and are worth a quick spot-check.",
    });
  }

  return groups.slice(0, 3);
}

function nextBestAction(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Wait for score";
  if (groundingOnly) return "Review before reuse";
  if ((score.overall_score || 0) >= 0.82) return "No action needed";
  if ((score.overall_score || 0) >= 0.65) return "Mark for follow-up";
  return "Escalate pattern";
}

function isLongMessage(content: string) {
  return content.length > 520 || content.split("\n").length > 10;
}

function groupClaimsForAdvancedReview(score?: QualityScore | null) {
  const claims = (score?.claim_analysis || []).filter((claim) => claim.verdict !== "verified");
  const grouped: Array<{ title: string; items: ClaimAnalysis[] }> = [];

  const buckets = [
    {
      title: "Record details to verify",
      test: (claim: ClaimAnalysis) => claimLooksLikeRecord(claim.claim),
    },
    {
      title: "Numbers to verify",
      test: (claim: ClaimAnalysis) => claimLooksLikeNumber(claim.claim),
    },
    {
      title: "Dates to verify",
      test: (claim: ClaimAnalysis) => claimLooksLikeDate(claim.claim),
    },
  ];

  const remaining = [...claims];

  for (const bucket of buckets) {
    const items = remaining.filter(bucket.test);
    if (items.length > 0) {
      grouped.push({ title: bucket.title, items: items.slice(0, 4) });
      for (const item of items) {
        const index = remaining.indexOf(item);
        if (index >= 0) remaining.splice(index, 1);
      }
    }
  }

  if (remaining.length > 0) {
    grouped.push({ title: "Other details to sense-check", items: remaining.slice(0, 4) });
  }

  return grouped;
}

function getAssessmentLabel(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Scoring in progress";
  if (groundingOnly && (score.overall_score || 0) >= 0.74) return "Strong answer";
  if ((score.overall_score || 0) >= 0.82) return "Healthy";
  if ((score.overall_score || 0) >= 0.65) return "Needs review";
  if ((score.overall_score || 0) >= 0.45) return "Risky";
  return "Broken";
}

function getRiskLine(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Risk is still being calculated.";
  if (groundingOnly) {
    return "Risk is moderate: the answer is useful, but any source-backed numbers, dates, or record details should be checked first.";
  }
  if ((score.overall_score || 0) >= 0.82) return "Risk is low. This answer looks solid.";
  if ((score.overall_score || 0) >= 0.65) return "Risk is moderate. Review before using this as a default pattern.";
  return "Risk is high. This response could create confusion or bad downstream decisions.";
}

function getEvidenceLabel(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return null;
  if (groundingOnly) return "Evidence limited";
  const flags = score.flags || [];
  if (flags.some((flag) => /grounding|trace|tool_backed|unverified|ungrounded/i.test(flag))) {
    return "Evidence mixed";
  }
  return "Evidence strong";
}

function getDisplaySummary(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Scoring in progress.";
  if (groundingOnly) {
    return "Useful answer. Check record details before reuse.";
  }
  return score.summary || "No summary available.";
}

export default function ConversationDetailPage() {
  const params = useParams();
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [showAdvancedDrawer, setShowAdvancedDrawer] = useState(false);
  const [reviewDisposition, setReviewDispositionState] = useState<ReviewDisposition | null>(null);
  const [nextConversationId, setNextConversationId] = useState<string | null>(null);
  const [overrideDimension, setOverrideDimension] = useState("overall");
  const [overrideScore, setOverrideScore] = useState("50");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideState, setOverrideState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [labelSetState, setLabelSetState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [labelNotes, setLabelNotes] = useState("");
  const [labelShareScope, setLabelShareScope] = useState<"workspace_private" | "global_anonymous">("workspace_private");
  const [labelExampleKind, setLabelExampleKind] = useState<"real" | "synthetic">("real");
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const [trainingLabels, setTrainingLabels] = useState({
    overall: "",
    accuracy: "",
    hallucination: "",
    resolution: "",
    escalation: "",
    tone: "",
    sentiment: "",
  });

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const loadConversation = async (isInitialLoad = false) => {
      try {
        const response = await fetch(`/api/conversations/${params.id}`, {
          cache: "no-store",
        });

        if (response.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }

        const data = (await response.json()) as ConversationDetail;
        if (cancelled) return;

        setConv(data);

        if (data.score_status === "pending" || data.score_status === "refreshing") {
          pollTimer = setTimeout(() => {
            void loadConversation(false);
          }, 2500);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled && isInitialLoad) {
          setLoading(false);
        }
      }
    };

    void loadConversation(true);

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [params.id]);

  useEffect(() => {
    if (!conv) return;
    const dispositions = getConversationDispositionMap();
    setReviewDispositionState(dispositions[conv.id] || null);
  }, [conv]);

  useEffect(() => {
    let cancelled = false;

    async function loadNextConversation() {
      try {
        const response = await fetch("/api/conversations?limit=100", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;

        const list = (data.conversations || []) as Array<{ id: string }>;
        const currentIndex = list.findIndex((item) => item.id === params.id);
        if (currentIndex >= 0 && currentIndex < list.length - 1) {
          setNextConversationId(list[currentIndex + 1]?.id || null);
        } else {
          setNextConversationId(null);
        }
      } catch (error) {
        console.error(error);
      }
    }

    void loadNextConversation();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function submitOverride() {
    if (!conv) return;

    setOverrideState("saving");
    try {
      const response = await fetch(`/api/conversations/${conv.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dimension: overrideDimension,
          override_score: Math.max(0, Math.min(1, Number(overrideScore) / 100)),
          reason: overrideReason || null,
        }),
      });

      if (!response.ok) {
        setOverrideState("error");
        return;
      }

      setOverrideState("saved");
      setShowOverrideForm(false);
      setOverrideReason("");
    } catch {
      setOverrideState("error");
    }
  }

  async function submitTrainingLabels() {
    if (!conv) return;

    setLabelSetState("saving");
    try {
      const response = await fetch("/api/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conv.id,
          labels: trainingLabels,
          notes: labelNotes || null,
          share_scope: labelShareScope,
          example_kind: labelExampleKind,
        }),
      });

      if (!response.ok) {
        setLabelSetState("error");
        return;
      }

      setLabelSetState("saved");
    } catch {
      setLabelSetState("error");
    }
  }

  function updateDisposition(disposition: ReviewDisposition) {
    if (!conv) return;
    setConversationDisposition(conv.id, disposition);
    setReviewDispositionState(disposition);

    const queueState =
      disposition === "safe"
        ? "safe"
        : disposition === "ignore"
          ? "reviewed"
          : disposition === "escalate_issue"
            ? "escalated"
            : disposition === "action_needed"
              ? "needs_review"
              : "reviewed";

    setQueueState(conv.id, queueState);
  }

  if (loading) {
    return (
      <div className="max-w-5xl">
        <Link href="/conversations" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-4 w-4" /> Back to review queue
        </Link>
        <GlassCard className="p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">Loading conversation review...</p>
        </GlassCard>
      </div>
    );
  }

  if (notFound || !conv) {
    return (
      <div className="max-w-5xl">
        <Link href="/conversations" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-4 w-4" /> Back to review queue
        </Link>
        <GlassCard className="p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">Conversation not found.</p>
        </GlassCard>
      </div>
    );
  }

  const qs = conv.quality_score;
  const groundingOnly = isGroundingRiskOnlyScore(qs);
  const confidenceLevel = qs?.confidence_level ?? qs?.structural_metrics?.confidence_level;
  const evidenceLabel = getEvidenceLabel(qs, groundingOnly);
  const assessmentLabel = getAssessmentLabel(qs, groundingOnly);
  const riskLine = getRiskLine(qs, groundingOnly);
  const displaySummary = getDisplaySummary(qs, groundingOnly);
  const strengths = deriveStrengths(conv.messages, qs);
  const reviewGroups = buildReviewGroups(qs);
  const advancedClaimGroups = groupClaimsForAdvancedReview(qs);
  const showKnowledgeAndPromptDetails = !groundingOnly;
  const actionState = nextBestAction(qs, groundingOnly);
  const roleConfig = {
    customer: { icon: User, label: "Customer", shell: "mr-auto bg-[var(--panel-subtle)]" },
    agent: { icon: Bot, label: "AI agent", shell: "ml-auto bg-[var(--surface-soft)]" },
    human_agent: { icon: Headphones, label: "Human agent", shell: "ml-auto bg-[var(--surface)]" },
    tool: { icon: Sparkles, label: "Tool", shell: "mx-auto bg-[var(--surface)]" },
    system: { icon: Sparkles, label: "System", shell: "mx-auto bg-[var(--surface)]" },
  } as const;

  const scoreRows = qs
    ? [
        { label: "Overall", score: qs.overall_score },
        { label: "Accuracy", score: qs.accuracy_score },
        { label: "Hallucination", score: qs.hallucination_score },
        { label: "Resolution", score: qs.resolution_score },
        { label: "Tone", score: qs.tone_score },
        { label: "Sentiment", score: qs.sentiment_score },
      ]
    : [];

  return (
    <div className="review-shell pb-10">
      <Link href="/conversations" className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        <ArrowLeft className="h-4 w-4" /> Back to review queue
      </Link>

      <section className="border-b border-[var(--divider)] pb-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="truncate font-semibold text-[var(--text-primary)]">
            {conv.customer_identifier || "Unknown customer"}
          </span>
          <span className="text-[var(--text-secondary)]">{conv.platform}</span>
          <span className="text-[var(--text-secondary)]">{conv.message_count} messages</span>
          <span className="text-[var(--text-secondary)]">{new Date(conv.created_at).toLocaleDateString("en-GB")}</span>
          {qs ? <ScoreBadge score={qs.overall_score} size="sm" /> : <span className="operator-chip">Pending</span>}
          <span className="operator-chip">{assessmentLabel}</span>
          {confidenceLevel ? <span className="operator-chip capitalize">{confidenceLevel}</span> : null}
          <span className="operator-chip">{reviewDisposition ? reviewDisposition.replaceAll("_", " ") : actionState}</span>
          {nextConversationId ? (
            <Link href={`/conversations/${nextConversationId}`} className="glass-button">
              Open next
            </Link>
          ) : null}
          <button type="button" className="glass-button" onClick={() => setShowAdvancedDrawer(true)}>
            Advanced
          </button>
        </div>
        <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
          {groundingOnly ? "Useful answer — verify record details." : displaySummary}
        </p>
      </section>

      <section className="border-b border-[var(--divider)] pb-3 text-sm">
        <div className="flex flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center xl:gap-5">
          {strengths.length > 0 ? (
            <div className="flex min-w-0 items-start gap-2">
              <span className="text-[var(--text-secondary)]">Worked:</span>
              <span className="truncate text-[var(--text-primary)]">{strengths[0]}</span>
            </div>
          ) : null}
          <div className="flex min-w-0 items-start gap-2">
            <span className="text-[var(--text-secondary)]">Check:</span>
            <span className="truncate text-[var(--text-primary)]">
              {reviewGroups.map((group) => group.title).join(", ") || "Nothing major"}
            </span>
          </div>
          <div className="flex min-w-0 items-start gap-2">
            <span className="text-[var(--text-secondary)]">Risk:</span>
            <span className="truncate text-[var(--text-primary)]">
              {groundingOnly ? "Moderate — verify before reuse." : riskLine}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.75fr)]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-[var(--text-primary)]">Transcript</p>
            <div className="flex flex-wrap gap-2">
              {evidenceLabel ? <span className="operator-chip">{evidenceLabel}</span> : null}
              {conv.was_escalated ? <span className="operator-chip score-bg-warning score-warning">Escalated</span> : null}
            </div>
          </div>

          {conv.messages.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No messages found.</p>
          ) : (
            <div className="space-y-3">
              {conv.messages.map((message) => {
                const config = roleConfig[message.role] || roleConfig.system;
                const Icon = config.icon;
                const expanded = expandedMessages[message.id] || false;
                const collapsible = message.role === "agent" && isLongMessage(message.content);
                const preview = collapsible && !expanded ? `${message.content.slice(0, 520).trimEnd()}…` : message.content;

                return (
                  <div key={message.id} className={`flex ${config.shell.includes("ml-auto") ? "justify-end" : config.shell.includes("mx-auto") ? "justify-center" : "justify-start"}`}>
                    <div className={`transcript-bubble max-w-[96%] px-3.5 py-3 sm:max-w-[88%] ${config.shell}`}>
                      <div className="mb-2 flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                          {config.label}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">
                        {preview}
                      </p>
                      {collapsible ? (
                        <button
                          type="button"
                          onClick={() => setExpandedMessages((current) => ({ ...current, [message.id]: !expanded }))}
                          className="mt-3 text-sm font-medium text-[var(--text-primary)]"
                        >
                          {expanded ? "Show less" : "Expand response"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="border-b border-[var(--divider)] pb-3">
            {qs ? (
              <div className="flex flex-wrap gap-2 text-sm">
                {scoreRows.map(({ label, score }) => (
                  <span key={label} className="operator-chip">
                    {label === "Hallucination" ? "Hall" : label === "Resolution" ? "Res" : label.slice(0, 4)}
                    <span className={`font-semibold ${scoreColor(score || 0)}`}>{formatScore(score || 0)}%</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                {conv.score_status === "waiting_for_completion"
                  ? "Waiting for the conversation to finish before scoring."
                  : conv.score_status === "refreshing"
                    ? "Updating the saved score."
                    : "Scoring in progress."}
              </p>
            )}
          </div>

          <div className="border-b border-[var(--divider)] pb-3 xl:sticky xl:top-20">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Next action</p>
            <div className="flex flex-wrap gap-2">
              {[
                ["safe", "Safe"],
                ["watch", "Watch"],
                ["action_needed", "Action"],
                ["escalate_issue", "Escalate"],
                ["ignore", "Ignore"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateDisposition(value as ReviewDisposition)}
                  className={`operator-chip transition-colors ${
                    reviewDisposition === value ? "border-[var(--border-strong)] bg-[var(--panel)] text-[var(--text-primary)]" : ""
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {showAdvancedDrawer ? (
        <>
          <button
            type="button"
            aria-label="Close advanced review"
            className="drawer-backdrop"
            onClick={() => setShowAdvancedDrawer(false)}
          />
          <aside className="drawer-panel">
            <div className="drawer-header">
              <div>
                <p className="page-eyebrow">Advanced review</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  Claims, evidence, overrides, training
                </h2>
              </div>
              <button type="button" onClick={() => setShowAdvancedDrawer(false)} className="operator-chip">
                <X className="h-4 w-4" />
                Close
              </button>
            </div>
            <div className="drawer-body space-y-3">
              {advancedClaimGroups.length > 0 ? (
                <div className="details-panel-content space-y-3">
                  {advancedClaimGroups.map((group) => (
                    <div key={group.title} className="compact-list-item">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{group.title}</p>
                      <div className="mt-2 space-y-2">
                        {group.items.map((claim) => (
                          <div key={`${group.title}-${claim.claim}`} className="border-b border-[var(--divider)] pb-2 last:border-b-0 last:pb-0">
                            <p className="text-sm text-[var(--text-primary)]">{claim.claim}</p>
                            <p className="mt-1 text-xs capitalize text-[var(--text-muted)]">{claim.verdict}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {showKnowledgeAndPromptDetails && qs?.prompt_improvements?.length ? (
                <div className="compact-list-item">
                  <p className="section-label">Prompt guidance</p>
                  <div className="mt-3 space-y-3">
                    {qs.prompt_improvements.slice(0, 3).map((improvement) => (
                      <div key={improvement.issue}>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{improvement.issue}</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{improvement.expected_impact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {showKnowledgeAndPromptDetails && qs?.knowledge_gaps?.length ? (
                <div className="compact-list-item">
                  <p className="section-label">Knowledge coverage</p>
                  <div className="mt-3 space-y-3">
                    {qs.knowledge_gaps.slice(0, 3).map((gap) => (
                      <div key={gap.topic}>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{gap.topic}</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{gap.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="compact-list-item">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Correct the score</p>
                <div className="mt-3 space-y-3">
                  {showOverrideForm ? (
                    <>
                      <select
                        value={overrideDimension}
                        onChange={(event) => setOverrideDimension(event.target.value)}
                        className="glass-input w-full px-3 py-2 text-sm"
                      >
                        <option value="overall">Overall</option>
                        <option value="accuracy">Accuracy</option>
                        <option value="hallucination">Hallucination</option>
                        <option value="resolution">Resolution</option>
                        <option value="tone">Tone</option>
                        <option value="sentiment">Sentiment</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={overrideScore}
                        onChange={(event) => setOverrideScore(event.target.value)}
                        className="glass-input w-full px-3 py-2 text-sm"
                        placeholder="Adjusted score %"
                      />
                      <GlassTextarea
                        value={overrideReason}
                        onChange={(event) => setOverrideReason(event.target.value)}
                        className="min-h-[88px]"
                        placeholder="Why is the current score wrong?"
                      />
                      <div className="flex gap-2">
                        <GlassButton size="sm" className="w-full" onClick={submitOverride} disabled={overrideState === "saving"}>
                          {overrideState === "saving" ? "Saving..." : "Save override"}
                        </GlassButton>
                        <GlassButton size="sm" variant="ghost" className="w-full" onClick={() => setShowOverrideForm(false)}>
                          Cancel
                        </GlassButton>
                      </div>
                    </>
                  ) : (
                    <GlassButton size="sm" className="w-full" onClick={() => setShowOverrideForm(true)}>
                      Add override
                    </GlassButton>
                  )}
                  {overrideState === "saved" ? <p className="text-xs text-score-good">Override saved.</p> : null}
                  {overrideState === "error" ? <p className="text-xs text-score-critical">Failed to save override.</p> : null}
                </div>
              </div>

              <div className="compact-list-item">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Train the scorer</p>
                <div className="mt-3 space-y-3">
                  {showTrainingForm ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <GlassSelect
                          label="Example type"
                          value={labelExampleKind}
                          onChange={(event) => setLabelExampleKind(event.target.value as "real" | "synthetic")}
                          options={[
                            { value: "real", label: "Real customer conversation" },
                            { value: "synthetic", label: "Synthetic training example" },
                          ]}
                        />
                        <GlassSelect
                          label="Training scope"
                          value={labelShareScope}
                          onChange={(event) => setLabelShareScope(event.target.value as "workspace_private" | "global_anonymous")}
                          options={[
                            { value: "workspace_private", label: "Private to this workspace" },
                            { value: "global_anonymous", label: "Share anonymized features" },
                          ]}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {Object.entries(trainingLabels).map(([key, value]) => (
                          <label key={key} className="space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{key}</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={value}
                              onChange={(event) =>
                                setTrainingLabels((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                              className="glass-input w-full px-3 py-2 text-sm"
                              placeholder="Optional %"
                            />
                          </label>
                        ))}
                      </div>
                      <GlassButton
                        size="sm"
                        variant="ghost"
                        className="w-full"
                        onClick={() =>
                          setTrainingLabels({
                            overall: qs ? String(Math.round(qs.overall_score * 100)) : "",
                            accuracy: qs?.accuracy_score !== undefined ? String(Math.round(qs.accuracy_score * 100)) : "",
                            hallucination: qs?.hallucination_score !== undefined ? String(Math.round(qs.hallucination_score * 100)) : "",
                            resolution: qs?.resolution_score !== undefined ? String(Math.round(qs.resolution_score * 100)) : "",
                            escalation: qs?.escalation_score !== undefined ? String(Math.round(qs.escalation_score * 100)) : "",
                            tone: qs?.tone_score !== undefined ? String(Math.round(qs.tone_score * 100)) : "",
                            sentiment: qs?.sentiment_score !== undefined ? String(Math.round(qs.sentiment_score * 100)) : "",
                          })
                        }
                      >
                        Start from current scores
                      </GlassButton>
                      <GlassTextarea
                        value={labelNotes}
                        onChange={(event) => setLabelNotes(event.target.value)}
                        className="min-h-[104px]"
                        placeholder="Why are these labels correct?"
                      />
                      <div className="flex gap-2">
                        <GlassButton size="sm" className="w-full" onClick={submitTrainingLabels} disabled={labelSetState === "saving"}>
                          {labelSetState === "saving" ? "Saving..." : "Save labels"}
                        </GlassButton>
                        <GlassButton size="sm" variant="ghost" className="w-full" onClick={() => setShowTrainingForm(false)}>
                          Cancel
                        </GlassButton>
                      </div>
                    </>
                  ) : (
                    <GlassButton size="sm" className="w-full" onClick={() => setShowTrainingForm(true)}>
                      Save training label
                    </GlassButton>
                  )}
                  {labelSetState === "saved" ? <p className="text-xs text-score-good">Labels saved.</p> : null}
                  {labelSetState === "error" ? <p className="text-xs text-score-critical">Failed to save labels.</p> : null}
                </div>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
