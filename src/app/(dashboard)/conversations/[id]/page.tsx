"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Headphones,
  Info,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassSelect, GlassTextarea } from "@/components/ui/glass-input";
import { ScoreBadge } from "@/components/ui/score-badge";
import { useToast } from "@/components/ui/toast";
import { formatScore, scoreAccent } from "@/lib/utils";
import type { ClaimAnalysis, Message, QualityScore } from "@/lib/db/types";
import {
  getConversationWorkflow,
  type ReviewDisposition,
} from "@/lib/review-workflow";
import { isGroundingRiskOnlyScore } from "@/lib/scoring/quality-score-status";

interface ConversationDetail {
  id: string;
  customer_identifier?: string;
  platform: string;
  message_count: number;
  was_escalated: boolean;
  created_at: string;
  messages: Message[];
  metadata?: Record<string, unknown> | null;
  quality_score: QualityScore | null;
  score_status?:
    | "pending"
    | "refreshing"
    | "ready"
    | "waiting_for_completion"
    | "waiting_for_quiet_period";
}

type AdvancedTab = "claims" | "evidence" | "override" | "training";

function hasStructuredAnswer(messages: Message[]) {
  return messages.some(
    (message) =>
      message.role === "agent" &&
      (/##|###|\|/.test(message.content) ||
        /priority|next step|what to do next|snapshot|risk|todo|summary|briefing/i.test(message.content))
  );
}

function hasAgentReply(messages: Message[]) {
  return messages.some((message) => message.role === "agent" && message.content.trim().length > 0);
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

function getAssessmentLabel(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Scoring";
  if (groundingOnly && (score.overall_score || 0) >= 0.74) return "Strong answer";
  if ((score.overall_score || 0) >= 0.82) return "Healthy";
  if ((score.overall_score || 0) >= 0.65) return "Needs review";
  if ((score.overall_score || 0) >= 0.45) return "Risky";
  return "Broken";
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
  if (groundingOnly) return "Useful answer. Verify specifics before reuse.";
  return score.summary || "No summary available.";
}

function deriveWorked(messages: Message[], score?: QualityScore | null) {
  if (!hasAgentReply(messages)) return "No agent reply";
  if (hasStructuredAnswer(messages)) return "Clear structure";
  if ((score?.resolution_score || 0) >= 0.78) return "Actionable next step";
  if ((score?.tone_score || 0) >= 0.84) return "Trustworthy tone";
  return "Usable answer";
}

function buildCheckItems(score?: QualityScore | null) {
  const claims = (score?.claim_analysis || []).filter((claim) => claim.verdict !== "verified");
  const checks: string[] = [];

  if (claims.some((claim) => claimLooksLikeRecord(claim.claim))) checks.push("Record details");
  if (claims.some((claim) => claimLooksLikeNumber(claim.claim))) checks.push("Metrics");
  if (claims.some((claim) => claimLooksLikeDate(claim.claim))) checks.push("Dates");
  if ((score?.flags || []).some((flag) => /policy|refund|pricing|compliance/i.test(flag))) {
    checks.push("Policy facts");
  }
  if ((score?.resolution_score || 1) < 0.45) checks.push("Resolution");

  return Array.from(new Set(checks)).slice(0, 3);
}

function deriveRiskLine(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Scoring";
  if (groundingOnly && (score.overall_score || 0) >= 0.74) return "Moderate if reused";
  if ((score.overall_score || 0) >= 0.82) return "Low reuse risk";
  if ((score.overall_score || 0) >= 0.65) return "Moderate if reused";
  if ((score.overall_score || 0) >= 0.45) return "High confusion risk";
  return "Unsafe to reuse";
}

function buildInsights(score?: QualityScore | null) {
  const claims = (score?.claim_analysis || []).filter((claim) => claim.verdict !== "verified");
  if (claims.length === 0) return [];

  const insights: { title: string; body: string; type: "risk" | "warning" | "info" }[] = [];

  if (claims.some((claim) => claimLooksLikeRecord(claim.claim))) {
    insights.push({
      title: "Check record details",
      body: "Deal fields, contact roles, or internal record details should be checked before reuse.",
      type: "warning",
    });
  }
  if (claims.some((claim) => claimLooksLikeNumber(claim.claim))) {
    insights.push({
      title: "Spot-check metrics",
      body: "Numbers and scores were stated confidently. Verify them before acting.",
      type: "warning",
    });
  }
  if (claims.some((claim) => claimLooksLikeDate(claim.claim))) {
    insights.push({
      title: "Confirm dates",
      body: "Dates, deadlines, and overdue status should be confirmed before planning.",
      type: "info",
    });
  }

  return insights.slice(0, 3);
}

function groupClaimsForAdvancedReview(score?: QualityScore | null) {
  const claims = (score?.claim_analysis || []).filter((claim) => claim.verdict !== "verified");
  const grouped: Array<{ title: string; items: ClaimAnalysis[] }> = [];

  const buckets = [
    { title: "Record details", test: (claim: ClaimAnalysis) => claimLooksLikeRecord(claim.claim) },
    { title: "Metrics", test: (claim: ClaimAnalysis) => claimLooksLikeNumber(claim.claim) },
    { title: "Dates", test: (claim: ClaimAnalysis) => claimLooksLikeDate(claim.claim) },
  ];

  const remaining = [...claims];
  for (const bucket of buckets) {
    const items = remaining.filter(bucket.test);
    if (items.length > 0) {
      grouped.push({ title: bucket.title, items: items.slice(0, 5) });
      for (const item of items) {
        const index = remaining.indexOf(item);
        if (index >= 0) remaining.splice(index, 1);
      }
    }
  }

  if (remaining.length > 0) {
    grouped.push({ title: "Other", items: remaining.slice(0, 5) });
  }

  return grouped;
}

function derivePrimaryAction(
  messages: Message[],
  score?: QualityScore | null,
  groundingOnly = false,
  checks: string[] = []
) {
  if (!score) return "Wait for scoring to finish.";
  if (!hasAgentReply(messages)) return "Review manually.";
  if (checks.includes("Record details")) return "Check record details before reuse.";
  if (checks.includes("Metrics")) return "Verify metrics before sharing.";
  if (checks.includes("Dates")) return "Confirm dates before acting.";
  if ((score.prompt_improvements || []).length > 0) return "Apply the first prompt fix.";
  if ((score.overall_score || 0) >= 0.82 && !groundingOnly) return "Mark safe and move on.";
  return groundingOnly ? "Verify specifics before reuse." : "Review before reuse.";
}

function getDispositionLabel(disposition: ReviewDisposition) {
  switch (disposition) {
    case "safe":
      return "Safe";
    case "watch":
      return "Watch";
    case "action_needed":
      return "Action";
    case "escalate_issue":
      return "Escalate";
    case "ignore":
      return "Ignore";
  }
}

function isLongMessage(content: string) {
  return content.length > 520 || content.split("\n").length > 10;
}

export default function ConversationDetailPage() {
  const params = useParams();
  const { success, error } = useToast();
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showAdvancedDrawer, setShowAdvancedDrawer] = useState(false);
  const [advancedTab, setAdvancedTab] = useState<AdvancedTab>("claims");
  const [nextConversationId, setNextConversationId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const [selectedDisposition, setSelectedDisposition] = useState<ReviewDisposition | null>(null);
  const [savingDisposition, setSavingDisposition] = useState<ReviewDisposition | null>(null);

  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideDimension, setOverrideDimension] = useState("overall");
  const [overrideScore, setOverrideScore] = useState("50");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideState, setOverrideState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [labelSetState, setLabelSetState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [labelNotes, setLabelNotes] = useState("");
  const [labelShareScope, setLabelShareScope] = useState<"workspace_private" | "global_anonymous">("workspace_private");
  const [labelExampleKind, setLabelExampleKind] = useState<"real" | "synthetic">("real");
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

    setNotFound(false);
    setServerError(false);

    const loadConversation = async (isInitialLoad = false) => {
      try {
        const response = await fetch(`/api/conversations/${params.id}`, { cache: "no-store" });
        if (response.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!response.ok) {
          if (!cancelled) setServerError(true);
          return;
        }
        const data = (await response.json()) as ConversationDetail;
        if (cancelled) return;
        setConv(data);
        const workflow = getConversationWorkflow(data.metadata || null);
        setSelectedDisposition(workflow?.disposition || null);

        if (data.score_status === "pending" || data.score_status === "refreshing") {
          pollTimer = setTimeout(() => {
            void loadConversation(false);
          }, 2500);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setServerError(true);
      } finally {
        if (!cancelled && isInitialLoad) setLoading(false);
      }
    };

    void loadConversation(true);
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [params.id, retryCount]);

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
        }
      } catch (err) {
        console.error(err);
      }
    }
    void loadNextConversation();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function applyDisposition(disposition: ReviewDisposition) {
    if (!conv) return;
    const previous = selectedDisposition;
    setSelectedDisposition(disposition);
    setSavingDisposition(disposition);

    try {
      const response = await fetch(`/api/conversations/${conv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition,
          queue_state:
            disposition === "safe"
              ? "safe"
              : disposition === "escalate_issue"
                ? "escalated"
                : disposition === "action_needed"
                  ? "needs_review"
                  : "reviewed",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update disposition");
      }

      success(`Marked ${getDispositionLabel(disposition).toLowerCase()}`);
    } catch (err) {
      console.error(err);
      setSelectedDisposition(previous);
      error("Could not update review state");
    } finally {
      setSavingDisposition(null);
    }
  }

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

  if (loading) {
    return (
      <div className="pb-8">
        <Link
          href="/conversations"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Review queue
        </Link>
        <div className="glass-static p-10 text-center">
          <p className="text-sm text-fg-muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (serverError) {
    return (
      <div className="pb-8">
        <Link
          href="/conversations"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Review queue
        </Link>
        <div className="glass-static p-10 text-center">
          <p className="text-sm font-medium text-fg-secondary">Could not load this conversation</p>
          <p className="mt-1 text-xs text-fg-muted">There was a problem fetching the data. Try again.</p>
          <GlassButton size="sm" className="mt-4" onClick={() => { setLoading(true); setRetryCount((n) => n + 1); }}>
            Retry
          </GlassButton>
        </div>
      </div>
    );
  }

  if (notFound || !conv) {
    return (
      <div className="pb-8">
        <Link
          href="/conversations"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Review queue
        </Link>
        <div className="glass-static p-10 text-center">
          <p className="text-sm text-fg-muted">Conversation not found.</p>
        </div>
      </div>
    );
  }

  const qs = conv.quality_score;
  const groundingOnly = isGroundingRiskOnlyScore(qs);
  const confidenceLevel = qs?.confidence_level ?? qs?.structural_metrics?.confidence_level;
  const evidenceLabel = getEvidenceLabel(qs, groundingOnly);
  const assessmentLabel = getAssessmentLabel(qs, groundingOnly);
  const displaySummary = getDisplaySummary(qs, groundingOnly);
  const checkItems = buildCheckItems(qs);
  const riskLine = deriveRiskLine(qs, groundingOnly);
  const workedLine = deriveWorked(conv.messages, qs);
  const primaryAction = derivePrimaryAction(conv.messages, qs, groundingOnly, checkItems);
  const insights = buildInsights(qs);
  const advancedClaimGroups = groupClaimsForAdvancedReview(qs);
  const showKnowledgeAndPromptDetails = !groundingOnly;

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

  const msgConfig = {
    customer: {
      icon: User,
      label: "Customer",
      bubbleClass: "msg-customer",
      align: "start" as const,
      avatarBg: "bg-[rgba(255,255,255,0.07)] border-[rgba(255,255,255,0.1)]",
    },
    agent: {
      icon: Bot,
      label: "AI agent",
      bubbleClass: "msg-agent",
      align: "end" as const,
      avatarBg: "bg-brand/[0.08] border-brand/20",
    },
    human_agent: {
      icon: Headphones,
      label: "Human agent",
      bubbleClass: "msg-human",
      align: "end" as const,
      avatarBg: "bg-score-good/[0.08] border-score-good/20",
    },
    tool: {
      icon: Sparkles,
      label: "Tool call",
      bubbleClass: "msg-tool",
      align: "center" as const,
      avatarBg: "bg-surface-secondary border-edge",
    },
    system: {
      icon: Sparkles,
      label: "System",
      bubbleClass: "msg-tool",
      align: "center" as const,
      avatarBg: "bg-surface-secondary border-edge",
    },
  } as const;

  return (
    <div className="space-y-6 pb-8">
      <div className="review-topline">
        <Link
          href="/conversations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Review queue
        </Link>
        <div className="review-action-strip">
          {nextConversationId && (
            <Link href={`/conversations/${nextConversationId}`} className="glass-button inline-flex items-center gap-1.5 text-sm">
              Open next
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <button type="button" className="glass-button text-sm" onClick={() => setShowAdvancedDrawer(true)}>
            Advanced
          </button>
        </div>
      </div>

      <section className="assessment-hero">
        <div className="glass-elevated p-6 sm:p-7">
          <div className="token-row">
            <span className="token-pill capitalize">{conv.platform}</span>
            <span className="token-pill">
              {new Date(conv.created_at).toLocaleDateString("en-GB")}
            </span>
            <span className="token-pill">{conv.message_count} messages</span>
            {evidenceLabel ? <span className="token-pill">{evidenceLabel}</span> : null}
            {conv.was_escalated ? <span className="token-pill">Escalated</span> : null}
          </div>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="page-eyebrow">Assessment</p>
              <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-fg sm:text-[2.4rem]">
                {conv.customer_identifier || "Unknown customer"}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {qs ? <ScoreBadge score={qs.overall_score} size="lg" /> : <span className="operator-chip">Scoring</span>}
                <span
                  className={`insight-badge ${
                    assessmentLabel === "Healthy" || assessmentLabel === "Strong answer"
                      ? "insight-badge-good"
                      : assessmentLabel === "Needs review" || assessmentLabel === "Risky"
                        ? "insight-badge-warning"
                        : assessmentLabel === "Broken"
                          ? "insight-badge-risk"
                          : ""
                  }`}
                >
                  {assessmentLabel}
                </span>
                {confidenceLevel ? <span className="operator-chip capitalize">{confidenceLevel} confidence</span> : null}
              </div>
              <p className="mt-5 text-xl leading-8 tracking-[-0.02em] text-fg">
                {displaySummary}
              </p>
              <p className="mt-3 text-base font-medium text-fg-secondary">
                {primaryAction}
              </p>
            </div>

            <div className="assessment-score-card rounded-xl border border-edge bg-surface-secondary p-5 sm:min-w-[260px]">
              <p className="page-eyebrow">Disposition</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(["safe", "watch", "action_needed", "escalate_issue"] as ReviewDisposition[]).map((disposition) => (
                  <button
                    key={disposition}
                    type="button"
                    onClick={() => applyDisposition(disposition)}
                    disabled={Boolean(savingDisposition)}
                    className={`disposition-btn ${selectedDisposition === disposition ? "disposition-btn-active" : ""}`}
                  >
                    <span className="text-sm font-semibold text-fg">{getDispositionLabel(disposition)}</span>
                  </button>
                ))}
              </div>
              {selectedDisposition ? (
                <p className="mt-4 text-xs text-fg-secondary">
                  Saved as {getDispositionLabel(selectedDisposition).toLowerCase()}.
                </p>
              ) : (
                <p className="mt-4 text-xs text-fg-secondary">
                  Mark the review outcome once you&apos;ve checked it.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="glass-static p-6">
          <p className="page-eyebrow">Why this matters</p>
          <div className="mt-4 assessment-strip">
            <div className="assessment-strip-item">
              <span className="value-key">Worked</span>
              <p className="value-text">{workedLine}</p>
            </div>
            <div className="assessment-strip-item">
              <span className="value-key">Check</span>
              <div className="token-row">
                {checkItems.length > 0 ? (
                  checkItems.map((item) => <span key={item} className="token-pill">{item}</span>)
                ) : (
                  <span className="value-text">No major checks</span>
                )}
              </div>
            </div>
            <div className="assessment-strip-item">
              <span className="value-key">Risk</span>
              <p className="value-text">{riskLine}</p>
            </div>
          </div>

          {insights.length > 0 && (
            <div className="mt-5 light-divider pt-5">
              <p className="page-eyebrow mb-3">Assessment notes</p>
              <div className="space-y-3">
                {insights.slice(0, 2).map((insight) => (
                  <div key={insight.title} className="flex items-start gap-3 rounded-lg border border-edge bg-surface-secondary p-3">
                    {insight.type === "risk" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-score-critical" />
                    ) : insight.type === "warning" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-score-warning" />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-fg">{insight.title}</p>
                      <p className="mt-1 text-sm leading-6 text-fg-secondary">{insight.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="transcript-shell">
        <div className="transcript-sheet overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-edge px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-fg">Transcript</p>
              <p className="text-xs text-fg-muted">{conv.messages.length} messages</p>
            </div>
            {evidenceLabel ? <span className="operator-chip">{evidenceLabel}</span> : null}
          </div>

          {conv.messages.length === 0 ? (
            <p className="p-5 text-sm text-fg-muted">No messages recorded.</p>
          ) : (
            <div className="space-y-4 p-5 sm:p-6">
              {conv.messages.map((message, index) => {
                const cfg = msgConfig[message.role as keyof typeof msgConfig] || msgConfig.system;
                const Icon = cfg.icon;
                const expanded = expandedMessages[message.id] || false;
                const collapsible = message.role === "agent" && isLongMessage(message.content);
                const preview = collapsible && !expanded ? `${message.content.slice(0, 560).trimEnd()}…` : message.content;
                const isRight = cfg.align === "end";
                const isCenter = cfg.align === "center";
                const timestamp = message.timestamp
                  ? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : null;

                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${isRight ? "flex-row-reverse" : isCenter ? "justify-center" : ""} animate-fade-in`}
                    style={{ animationDelay: `${index * 28}ms` }}
                  >
                    {!isCenter && (
                      <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${cfg.avatarBg}`}>
                        <Icon className="h-4 w-4 text-fg-secondary" />
                      </div>
                    )}

                    <div className={`max-w-[640px] ${isCenter ? "w-full" : ""}`}>
                      <div className={`px-4 py-3.5 text-sm ${cfg.bubbleClass}`}>
                        <p className={`whitespace-pre-wrap leading-7 text-fg ${isRight ? "text-right" : ""}`}>
                          {preview}
                        </p>
                        {collapsible && (
                          <button
                            type="button"
                            onClick={() => setExpandedMessages((current) => ({ ...current, [message.id]: !expanded }))}
                            className="mt-3 text-xs font-semibold text-brand hover:text-brand-light"
                          >
                            {expanded ? "Show less" : "Show full response"}
                          </button>
                        )}
                      </div>
                      <div className={`mt-1 flex items-center gap-2 ${isRight ? "justify-end" : ""}`}>
                        <span className="text-[11px] font-medium text-fg-muted">{cfg.label}</span>
                        {timestamp ? <span className="text-[11px] text-fg-faint">{timestamp}</span> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="page-eyebrow">Scores</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-fg">Breakdown</p>
              </div>
              {qs ? <ScoreBadge score={qs.overall_score} size="sm" /> : null}
            </div>

            {!qs ? (
              <p className="mt-4 text-sm text-fg-secondary">
                {conv.score_status === "waiting_for_completion"
                  ? "Waiting for the conversation to finish."
                  : conv.score_status === "refreshing"
                    ? "Refreshing score…"
                    : "Scoring in progress…"}
              </p>
            ) : (
              <div className="mt-4 score-strip">
                {scoreRows.map(({ label, score }) => {
                  const safeScore = score ?? 0;
                  return (
                    <div key={label} className="score-strip-row">
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium text-fg-secondary">{label}</span>
                          <span className="text-xs font-semibold font-mono tabular-nums" style={{ color: scoreAccent(safeScore) }}>
                            {formatScore(safeScore)}%
                          </span>
                        </div>
                        <div className="score-strip-bar">
                          <div
                            className="score-strip-fill"
                            style={{ width: `${safeScore * 100}%`, background: scoreAccent(safeScore) }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <p className="page-eyebrow">Best next move</p>
            <div className="action-card mt-4">
              <p className="text-sm font-semibold text-fg">{primaryAction}</p>
              {showKnowledgeAndPromptDetails && qs?.prompt_improvements?.[0]?.expected_impact ? (
                <p className="mt-2 text-sm leading-6 text-fg-secondary">
                  {qs.prompt_improvements[0].expected_impact}
                </p>
              ) : (
                <p className="mt-2 text-sm leading-6 text-fg-secondary">
                  Use the transcript below to spot-check the claims that matter.
                </p>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="page-eyebrow">Details</p>
            <div className="mt-4 info-grid">
              {[
                { label: "Platform", value: conv.platform },
                { label: "Messages", value: String(conv.message_count) },
                { label: "Date", value: new Date(conv.created_at).toLocaleDateString("en-GB") },
                confidenceLevel ? { label: "Confidence", value: confidenceLevel } : null,
              ]
                .filter(Boolean)
                .map((row) => row && (
                  <div key={row.label} className="info-row">
                    <span className="text-xs text-fg-muted">{row.label}</span>
                    <span className="text-xs font-medium capitalize text-fg-secondary">{row.value}</span>
                  </div>
                ))}
            </div>
          </GlassCard>
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
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-fg">
                  Claims, evidence and calibration
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedDrawer(false)}
                className="glass-button py-1 px-2 text-xs inline-flex items-center gap-1 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="drawer-body">
              <div className="mb-5 flex flex-wrap gap-2">
                {([
                  ["claims", "Claims"],
                  ["evidence", "Evidence"],
                  ["override", "Override"],
                  ["training", "Training"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAdvancedTab(key)}
                    className={`operator-chip cursor-pointer ${advancedTab === key ? "!bg-[rgba(94,106,210,0.15)] !text-[#7178E0] !border-[rgba(94,106,210,0.3)]" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {advancedTab === "claims" && (
                <div className="space-y-4">
                  {advancedClaimGroups.length > 0 ? (
                    advancedClaimGroups.map((group) => (
                      <div key={group.title} className="compact-list-item">
                        <p className="text-sm font-semibold text-fg">{group.title}</p>
                        <div className="mt-3 space-y-3">
                          {group.items.map((claim) => (
                            <div key={`${group.title}-${claim.claim}`} className="rounded-lg border p-3" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.07)" }}>
                              <p className="text-sm text-fg">{claim.claim}</p>
                              <p className="mt-1 text-xs capitalize text-fg-muted">{claim.verdict}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="empty-inline">No claim checks for this conversation.</p>
                  )}
                </div>
              )}

              {advancedTab === "evidence" && (
                <div className="space-y-4">
                  {insights.length > 0 ? (
                    <div className="compact-list-item">
                      <p className="text-sm font-semibold text-fg">Evidence notes</p>
                      <div className="mt-3 space-y-3">
                        {insights.map((insight) => (
                          <div key={insight.title} className="rounded-lg border p-3" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.07)" }}>
                            <p className="text-sm font-semibold text-fg">{insight.title}</p>
                            <p className="mt-1 text-sm leading-6 text-fg-secondary">{insight.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {showKnowledgeAndPromptDetails && qs?.prompt_improvements?.length ? (
                    <div className="compact-list-item">
                      <p className="text-sm font-semibold text-fg">Prompt fixes</p>
                      <div className="mt-3 space-y-3">
                        {qs.prompt_improvements.slice(0, 3).map((improvement) => (
                          <div key={improvement.issue} className="rounded-lg border p-3" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.07)" }}>
                            <p className="text-sm font-semibold text-fg">{improvement.issue}</p>
                            <p className="mt-1 text-sm leading-6 text-fg-secondary">{improvement.expected_impact}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {showKnowledgeAndPromptDetails && qs?.knowledge_gaps?.length ? (
                    <div className="compact-list-item">
                      <p className="text-sm font-semibold text-fg">Knowledge gaps</p>
                      <div className="mt-3 space-y-3">
                        {qs.knowledge_gaps.slice(0, 3).map((gap) => (
                          <div key={gap.topic} className="rounded-lg border p-3" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.07)" }}>
                            <p className="text-sm font-semibold text-fg">{gap.topic}</p>
                            <p className="mt-1 text-sm leading-6 text-fg-secondary">{gap.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {!insights.length && !(qs?.prompt_improvements?.length || qs?.knowledge_gaps?.length) ? (
                    <p className="empty-inline">No extra evidence notes for this conversation.</p>
                  ) : null}
                </div>
              )}

              {advancedTab === "override" && (
                <div>
                  <p className="text-sm font-semibold text-fg">Correct the score</p>
                  {showOverrideForm ? (
                    <div className="mt-4 space-y-3">
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
                        placeholder="Score %"
                      />
                      <GlassTextarea
                        value={overrideReason}
                        onChange={(event) => setOverrideReason(event.target.value)}
                        className="min-h-[84px]"
                        placeholder="Why is the current score wrong?"
                      />
                      <div className="flex gap-2">
                        <GlassButton size="sm" className="w-full" onClick={submitOverride} disabled={overrideState === "saving"}>
                          {overrideState === "saving" ? "Saving…" : "Save override"}
                        </GlassButton>
                        <GlassButton size="sm" variant="ghost" className="w-full" onClick={() => setShowOverrideForm(false)}>
                          Cancel
                        </GlassButton>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <GlassButton size="sm" onClick={() => setShowOverrideForm(true)}>
                        Add override
                      </GlassButton>
                    </div>
                  )}
                  {overrideState === "saved" ? <p className="mt-3 text-xs text-score-good">Override saved.</p> : null}
                  {overrideState === "error" ? <p className="mt-3 text-xs text-score-critical">Failed to save.</p> : null}
                </div>
              )}

              {advancedTab === "training" && (
                <div>
                  <p className="text-sm font-semibold text-fg">Train the scorer</p>
                  {showTrainingForm ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <GlassSelect
                          label="Example type"
                          value={labelExampleKind}
                          onChange={(event) => setLabelExampleKind(event.target.value as "real" | "synthetic")}
                          options={[
                            { value: "real", label: "Real conversation" },
                            { value: "synthetic", label: "Synthetic example" },
                          ]}
                        />
                        <GlassSelect
                          label="Scope"
                          value={labelShareScope}
                          onChange={(event) =>
                            setLabelShareScope(event.target.value as "workspace_private" | "global_anonymous")
                          }
                          options={[
                            { value: "workspace_private", label: "Private" },
                            { value: "global_anonymous", label: "Shared anonymous" },
                          ]}
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {Object.entries(trainingLabels).map(([key, value]) => (
                          <label key={key} className="space-y-1">
                            <span className="text-[11px] font-semibold capitalize text-fg-secondary">{key}</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={value}
                              onChange={(event) => setTrainingLabels((current) => ({ ...current, [key]: event.target.value }))}
                              className="glass-input w-full px-3 py-2 text-sm"
                              placeholder="%"
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
                            hallucination:
                              qs?.hallucination_score !== undefined ? String(Math.round(qs.hallucination_score * 100)) : "",
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
                        className="min-h-[84px]"
                        placeholder="Why are these labels correct?"
                      />

                      <div className="flex gap-2">
                        <GlassButton size="sm" className="w-full" onClick={submitTrainingLabels} disabled={labelSetState === "saving"}>
                          {labelSetState === "saving" ? "Saving…" : "Save labels"}
                        </GlassButton>
                        <GlassButton size="sm" variant="ghost" className="w-full" onClick={() => setShowTrainingForm(false)}>
                          Cancel
                        </GlassButton>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <GlassButton size="sm" onClick={() => setShowTrainingForm(true)}>
                        Save training label
                      </GlassButton>
                    </div>
                  )}
                  {labelSetState === "saved" ? <p className="mt-3 text-xs text-score-good">Labels saved.</p> : null}
                  {labelSetState === "error" ? <p className="mt-3 text-xs text-score-critical">Failed to save.</p> : null}
                </div>
              )}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
