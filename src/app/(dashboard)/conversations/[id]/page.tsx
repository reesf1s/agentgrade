"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Headphones,
  Info,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassSelect, GlassTextarea } from "@/components/ui/glass-input";
import { ScoreBadge } from "@/components/ui/score-badge";
import { scoreColor, formatScore, scoreAccent } from "@/lib/utils";
import type { ClaimAnalysis, Message, QualityScore } from "@/lib/db/types";
import { isGroundingRiskOnlyScore } from "@/lib/scoring/quality-score-status";

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
  if ((score?.resolution_score || 0) >= 0.78) strengths.push("Clear next step");
  if ((score?.tone_score || 0) >= 0.84) strengths.push("Professional tone");
  if (hasStructuredAnswer(messages)) strengths.push("Well structured");
  if ((score?.overall_score || 0) >= 0.8) strengths.push("Reusable pattern");
  return strengths.slice(0, 3);
}

function claimLooksLikeDate(text: string) {
  return /\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|deadline|due|close date|week|month|quarter|day)\b/i.test(text);
}

function claimLooksLikeNumber(text: string) {
  return /[%£$€]|\b\d+(\.\d+)?\b|score|probability|value|hours|rate|metric|accuracy|conversion|win rate|amount/i.test(text);
}

function claimLooksLikeRecord(text: string) {
  return /\b(deal|account|company|contact|ticket|subscription|order|record|crm|pipeline|stage|owner|champion|todo|history|health|risk|briefing|competitor)\b/i.test(text);
}

function buildInsights(score?: QualityScore | null) {
  const claims = (score?.claim_analysis || []).filter((claim) => claim.verdict !== "verified");
  if (claims.length === 0) return [];

  const insights: { title: string; body: string; type: "risk" | "warning" | "info" }[] = [];

  if (claims.some((claim) => claimLooksLikeRecord(claim.claim))) {
    insights.push({
      title: "Record details to verify",
      body: "Deal fields, contact roles, or internal record details should be checked against the source system.",
      type: "warning",
    });
  }
  if (claims.some((claim) => claimLooksLikeNumber(claim.claim))) {
    insights.push({
      title: "Numbers need spot-checking",
      body: "Metrics, values, or scores were stated confidently — verify before acting on them.",
      type: "warning",
    });
  }
  if (claims.some((claim) => claimLooksLikeDate(claim.claim))) {
    insights.push({
      title: "Date accuracy uncertain",
      body: "Dates, deadlines, and overdue status should be confirmed before using in planning.",
      type: "warning",
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: "Details need verification",
      body: "Some specific claims are not fully traceable in the transcript.",
      type: "info",
    });
  }

  return insights.slice(0, 3);
}

function groupClaimsForAdvancedReview(score?: QualityScore | null) {
  const claims = (score?.claim_analysis || []).filter((claim) => claim.verdict !== "verified");
  const grouped: Array<{ title: string; items: ClaimAnalysis[] }> = [];

  const buckets = [
    { title: "Record details to verify", test: (claim: ClaimAnalysis) => claimLooksLikeRecord(claim.claim) },
    { title: "Numbers to verify", test: (claim: ClaimAnalysis) => claimLooksLikeNumber(claim.claim) },
    { title: "Dates to verify", test: (claim: ClaimAnalysis) => claimLooksLikeDate(claim.claim) },
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
    grouped.push({ title: "Other claims to check", items: remaining.slice(0, 4) });
  }
  return grouped;
}

function getAssessmentLabel(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Scoring…";
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
  if (flags.some((flag) => /grounding|trace|tool_backed|unverified|ungrounded/i.test(flag))) return "Evidence mixed";
  return "Evidence strong";
}

function getDisplaySummary(score?: QualityScore | null, groundingOnly = false) {
  if (!score) return "Scoring in progress.";
  if (groundingOnly) return "Useful, but verify first.";
  return score.summary || "No summary available.";
}

function isLongMessage(content: string) {
  return content.length > 520 || content.split("\n").length > 10;
}


export default function ConversationDetailPage() {
  const params = useParams();
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showAdvancedDrawer, setShowAdvancedDrawer] = useState(false);
  const [nextConversationId, setNextConversationId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});

  // Override form state
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideDimension, setOverrideDimension] = useState("overall");
  const [overrideScore, setOverrideScore] = useState("50");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideState, setOverrideState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Training labels
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [labelSetState, setLabelSetState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [labelNotes, setLabelNotes] = useState("");
  const [labelShareScope, setLabelShareScope] = useState<"workspace_private" | "global_anonymous">("workspace_private");
  const [labelExampleKind, setLabelExampleKind] = useState<"real" | "synthetic">("real");
  const [trainingLabels, setTrainingLabels] = useState({
    overall: "", accuracy: "", hallucination: "", resolution: "", escalation: "", tone: "", sentiment: "",
  });

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const loadConversation = async (isInitialLoad = false) => {
      try {
        const response = await fetch(`/api/conversations/${params.id}`, { cache: "no-store" });
        if (response.status === 404) { if (!cancelled) setNotFound(true); return; }
        const data = (await response.json()) as ConversationDetail;
        if (cancelled) return;
        setConv(data);
        if (data.score_status === "pending" || data.score_status === "refreshing") {
          pollTimer = setTimeout(() => { void loadConversation(false); }, 2500);
        }
      } catch (err) { console.error(err); }
      finally { if (!cancelled && isInitialLoad) setLoading(false); }
    };

    void loadConversation(true);
    return () => { cancelled = true; if (pollTimer) clearTimeout(pollTimer); };
  }, [params.id]);

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
      } catch (err) { console.error(err); }
    }
    void loadNextConversation();
    return () => { cancelled = true; };
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
      if (!response.ok) { setOverrideState("error"); return; }
      setOverrideState("saved");
      setShowOverrideForm(false);
      setOverrideReason("");
    } catch { setOverrideState("error"); }
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
      if (!response.ok) { setLabelSetState("error"); return; }
      setLabelSetState("saved");
    } catch { setLabelSetState("error"); }
  }

  if (loading) {
    return (
      <div className="pb-8">
        <Link href="/conversations" className="mb-5 inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" /> Conversations
        </Link>
        <div className="glass-static p-10 text-center">
          <p className="text-sm text-fg-muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (notFound || !conv) {
    return (
      <div className="pb-8">
        <Link href="/conversations" className="mb-5 inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" /> Conversations
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
  const strengths = deriveStrengths(conv.messages, qs);
  const insights = buildInsights(qs);
  const advancedClaimGroups = groupClaimsForAdvancedReview(qs);
  const showKnowledgeAndPromptDetails = !groundingOnly;

  const msgConfig = {
    customer:    { icon: User,      label: "Customer",     bubbleClass: "msg-customer", align: "start" as const, avatarBg: "bg-surface-elevated border-edge" },
    agent:       { icon: Bot,       label: "AI agent",     bubbleClass: "msg-agent",    align: "end"   as const, avatarBg: "bg-brand-muted border-brand/20" },
    human_agent: { icon: Headphones,label: "Human agent",  bubbleClass: "msg-human",    align: "end"   as const, avatarBg: "bg-green-500/10 border-green-500/20" },
    tool:        { icon: Sparkles,  label: "Tool call",    bubbleClass: "msg-tool",     align: "center"as const, avatarBg: "bg-surface border-edge" },
    system:      { icon: Sparkles,  label: "System",       bubbleClass: "msg-tool",     align: "center"as const, avatarBg: "bg-surface border-edge" },
  } as const;

  const scoreRows = qs ? [
    { label: "Overall",       score: qs.overall_score },
    { label: "Accuracy",      score: qs.accuracy_score },
    { label: "Hallucination", score: qs.hallucination_score },
    { label: "Resolution",    score: qs.resolution_score },
    { label: "Tone",          score: qs.tone_score },
  ] : [];

  return (
    <div className="space-y-4 pb-8">
      {/* Topnav */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/conversations" className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary hover:text-fg transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Conversations
        </Link>
        <div className="flex items-center gap-2">
          {nextConversationId && (
            <Link href={`/conversations/${nextConversationId}`} className="glass-button inline-flex items-center gap-1.5 text-xs">
              Next <ArrowRight className="h-3 w-3" />
            </Link>
          )}
          <button type="button" className="glass-button text-xs" onClick={() => setShowAdvancedDrawer(true)}>
            Deep dive
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="glass-static p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="operator-chip capitalize">{conv.platform}</span>
          <span className="operator-chip">{new Date(conv.created_at).toLocaleDateString("en-GB")}</span>
          <span className="operator-chip">{conv.message_count} messages</span>
          {qs ? <ScoreBadge score={qs.overall_score} size="sm" /> : <span className="operator-chip">Scoring…</span>}
          <span className={`insight-badge ${
            assessmentLabel === "Healthy" || assessmentLabel === "Strong answer" ? "insight-badge-good" :
            assessmentLabel === "Needs review" || assessmentLabel === "Risky" ? "insight-badge-warning" :
            assessmentLabel === "Broken" ? "insight-badge-risk" : ""
          }`}>{assessmentLabel}</span>
          {conv.was_escalated && <span className="insight-badge insight-badge-warning">Escalated</span>}
        </div>

        <h1 className="text-xl font-bold tracking-[-0.02em] text-fg">
          {conv.customer_identifier || "Unknown customer"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">
          {displaySummary}
        </p>

        {(strengths.length > 0 || insights.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-edge pt-3.5 text-xs">
            {strengths.slice(0, 2).map((s) => (
              <span key={s} className="flex items-center gap-1.5 font-medium text-[#10B981]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {s}
              </span>
            ))}
            {insights.slice(0, 2).map((i) => (
              <span key={i.title} className="flex items-center gap-1.5 font-medium text-[#F59E0B]">
                <AlertTriangle className="h-3.5 w-3.5" />
                {i.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Main 2-col grid */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">

        {/* Transcript */}
        <div className="glass-static overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-edge px-5 py-3">
            <p className="text-sm font-semibold text-fg">
              Transcript
              <span className="ml-1.5 text-xs font-normal text-fg-muted">{conv.messages.length} messages</span>
            </p>
            {evidenceLabel && <span className="operator-chip">{evidenceLabel}</span>}
          </div>

          {conv.messages.length === 0 ? (
            <p className="p-5 text-sm text-fg-muted">No messages recorded.</p>
          ) : (
            <div className="space-y-4 p-5">
              {conv.messages.map((message, idx) => {
                const cfg = msgConfig[message.role as keyof typeof msgConfig] || msgConfig.system;
                const Icon = cfg.icon;
                const expanded = expandedMessages[message.id] || false;
                const collapsible = message.role === "agent" && isLongMessage(message.content);
                const preview = collapsible && !expanded ? `${message.content.slice(0, 520).trimEnd()}…` : message.content;
                const isRight = cfg.align === "end";
                const isCenter = cfg.align === "center";
                const ts = message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

                return (
                  <div key={message.id} className={`flex gap-2.5 ${isRight ? "flex-row-reverse" : isCenter ? "justify-center" : ""} animate-fade-in`} style={{ animationDelay: `${idx * 30}ms` }}>
                    {/* Avatar */}
                    {!isCenter && (
                      <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 mt-1 ${cfg.avatarBg}`}>
                        <Icon className="h-3.5 w-3.5 text-fg-secondary" />
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`max-w-[520px] ${isCenter ? "w-full" : ""}`}>
                      <div className={`px-4 py-3 text-sm ${cfg.bubbleClass} transition-shadow hover:shadow-glass`}>
                        <p className={`whitespace-pre-wrap leading-relaxed text-fg-secondary ${isRight ? "text-right" : ""}`}>
                          {preview}
                        </p>
                        {collapsible && (
                          <button
                            type="button"
                            onClick={() => setExpandedMessages((cur) => ({ ...cur, [message.id]: !expanded }))}
                            className="mt-2 text-xs font-semibold text-brand-light hover:text-brand transition-colors"
                          >
                            {expanded ? "Show less" : "Show full response"}
                          </button>
                        )}
                      </div>
                      {/* Timestamp + role label */}
                      <div className={`mt-1 flex items-center gap-2 ${isRight ? "justify-end" : ""}`}>
                        <span className="text-[11px] font-medium text-fg-muted">{cfg.label}</span>
                        {ts && <span className="text-[11px] text-fg-faint">{ts}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right sidebar — insights, not actions */}
        <div className="space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:self-start">

          {/* Score card */}
          <div className="glass-static p-4">
            <p className="section-label mb-3">Quality scores</p>
            {!qs ? (
              <p className="text-sm text-fg-secondary">
                {conv.score_status === "waiting_for_completion"
                  ? "Waiting for conversation to end."
                  : conv.score_status === "refreshing"
                  ? "Updating score…"
                  : "Scoring in progress…"}
              </p>
            ) : (
              <div className="space-y-3">
                {scoreRows.map(({ label, score }) => {
                  const s = score ?? 0;
                  return (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-fg-secondary">{label}</span>
                        <span className={`text-xs font-semibold tabular-nums font-mono ${scoreColor(s)}`}>
                          {formatScore(s)}%
                        </span>
                      </div>
                      <div className="score-bar-track">
                        <div
                          className="score-bar-fill"
                          style={{ width: `${s * 100}%`, background: scoreAccent(s) }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Insights card — replaces dispositions */}
          {insights.length > 0 && (
            <div className="glass-static p-4">
              <p className="section-label mb-3">Insights</p>
              <div className="space-y-3">
                {insights.map((i) => (
                  <div key={i.title}>
                    <div className="flex items-start gap-2">
                      {i.type === "risk" ? (
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#EF4444]" />
                      ) : i.type === "warning" ? (
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#F59E0B]" />
                      ) : (
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-fg-muted" />
                      )}
                      <div>
                        <p className="text-xs font-semibold text-fg">{i.title}</p>
                        <p className="mt-0.5 text-xs text-fg-secondary leading-relaxed">{i.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt improvements — surface inline */}
          {showKnowledgeAndPromptDetails && qs?.prompt_improvements?.length ? (
            <div className="glass-static p-4">
              <p className="section-label mb-3">Suggested fixes</p>
              <div className="space-y-3">
                {qs.prompt_improvements.slice(0, 2).map((improvement) => (
                  <div key={improvement.issue}>
                    <p className="text-xs font-semibold text-fg">{improvement.issue}</p>
                    <p className="mt-0.5 text-xs text-fg-secondary leading-relaxed">{improvement.expected_impact}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Metadata */}
          <div className="glass-static p-4">
            <p className="section-label mb-2.5">Details</p>
            <div className="space-y-2">
              {[
                { k: "Platform",   v: conv.platform },
                { k: "Messages",   v: conv.message_count },
                { k: "Date",       v: new Date(conv.created_at).toLocaleDateString("en-GB") },
                confidenceLevel ? { k: "Confidence", v: confidenceLevel } : null,
              ].filter(Boolean).map((row) => row && (
                <div key={row.k} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-fg-muted">{row.k}</span>
                  <span className="text-xs font-medium capitalize text-fg-secondary">{String(row.v)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced drawer */}
      {showAdvancedDrawer ? (
        <>
          <button
            type="button"
            aria-label="Close deep dive"
            className="drawer-backdrop"
            onClick={() => setShowAdvancedDrawer(false)}
          />
          <aside className="drawer-panel">
            <div className="drawer-header">
              <div>
                <p className="page-eyebrow">Deep dive</p>
                <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-fg">
                  Claims, evidence &amp; calibration
                </h2>
              </div>
              <button type="button" onClick={() => setShowAdvancedDrawer(false)} className="glass-button py-1 px-2 text-xs inline-flex items-center gap-1 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="drawer-body space-y-4">
              {/* Claims */}
              {advancedClaimGroups.length > 0 && (
                <div className="space-y-3">
                  {advancedClaimGroups.map((group) => (
                    <div key={group.title} className="border-b border-edge pb-3 last:border-0">
                      <p className="text-sm font-semibold text-fg mb-2">{group.title}</p>
                      <div className="space-y-2">
                        {group.items.map((claim) => (
                          <div key={`${group.title}-${claim.claim}`} className="border-b border-edge pb-2 last:border-0 last:pb-0">
                            <p className="text-sm text-fg">{claim.claim}</p>
                            <p className="mt-1 text-xs capitalize text-fg-muted">{claim.verdict}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Prompt guidance */}
              {showKnowledgeAndPromptDetails && qs?.prompt_improvements?.length ? (
                <div className="border-b border-edge pb-3">
                  <p className="section-label mb-2">Prompt guidance</p>
                  <div className="space-y-3">
                    {qs.prompt_improvements.slice(0, 3).map((improvement) => (
                      <div key={improvement.issue}>
                        <p className="text-sm font-semibold text-fg">{improvement.issue}</p>
                        <p className="mt-1 text-sm leading-relaxed text-fg-secondary">{improvement.expected_impact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Knowledge gaps */}
              {showKnowledgeAndPromptDetails && qs?.knowledge_gaps?.length ? (
                <div className="border-b border-edge pb-3">
                  <p className="section-label mb-2">Knowledge gaps</p>
                  <div className="space-y-3">
                    {qs.knowledge_gaps.slice(0, 3).map((gap) => (
                      <div key={gap.topic}>
                        <p className="text-sm font-semibold text-fg">{gap.topic}</p>
                        <p className="mt-1 text-sm leading-relaxed text-fg-secondary">{gap.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Score override */}
              <div className="border-b border-edge pb-3">
                <p className="text-sm font-semibold text-fg mb-2">Correct the score</p>
                {showOverrideForm ? (
                  <div className="space-y-3">
                    <select value={overrideDimension} onChange={(e) => setOverrideDimension(e.target.value)} className="glass-input w-full px-3 py-2 text-sm">
                      <option value="overall">Overall</option>
                      <option value="accuracy">Accuracy</option>
                      <option value="hallucination">Hallucination</option>
                      <option value="resolution">Resolution</option>
                      <option value="tone">Tone</option>
                      <option value="sentiment">Sentiment</option>
                    </select>
                    <input type="number" min={0} max={100} value={overrideScore} onChange={(e) => setOverrideScore(e.target.value)} className="glass-input w-full px-3 py-2 text-sm" placeholder="Score %" />
                    <GlassTextarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className="min-h-[80px]" placeholder="Why is the current score wrong?" />
                    <div className="flex gap-2">
                      <GlassButton size="sm" className="w-full" onClick={submitOverride} disabled={overrideState === "saving"}>
                        {overrideState === "saving" ? "Saving…" : "Save override"}
                      </GlassButton>
                      <GlassButton size="sm" variant="ghost" className="w-full" onClick={() => setShowOverrideForm(false)}>Cancel</GlassButton>
                    </div>
                  </div>
                ) : (
                  <GlassButton size="sm" className="w-full" onClick={() => setShowOverrideForm(true)}>Add override</GlassButton>
                )}
                {overrideState === "saved" && <p className="mt-2 text-xs text-[#10B981]">Override saved.</p>}
                {overrideState === "error" && <p className="mt-2 text-xs text-[#EF4444]">Failed to save.</p>}
              </div>

              {/* Training labels */}
              <div>
                <p className="text-sm font-semibold text-fg mb-2">Train the scorer</p>
                {showTrainingForm ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <GlassSelect label="Example type" value={labelExampleKind} onChange={(e) => setLabelExampleKind(e.target.value as "real" | "synthetic")} options={[{ value: "real", label: "Real conversation" }, { value: "synthetic", label: "Synthetic example" }]} />
                      <GlassSelect label="Scope" value={labelShareScope} onChange={(e) => setLabelShareScope(e.target.value as "workspace_private" | "global_anonymous")} options={[{ value: "workspace_private", label: "Private" }, { value: "global_anonymous", label: "Shared anonymous" }]} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {Object.entries(trainingLabels).map(([key, value]) => (
                        <label key={key} className="space-y-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">{key}</span>
                          <input type="number" min={0} max={100} value={value} onChange={(e) => setTrainingLabels((c) => ({ ...c, [key]: e.target.value }))} className="glass-input w-full px-3 py-2 text-sm" placeholder="%" />
                        </label>
                      ))}
                    </div>
                    <GlassButton size="sm" variant="ghost" className="w-full" onClick={() => setTrainingLabels({
                      overall: qs ? String(Math.round(qs.overall_score * 100)) : "",
                      accuracy: qs?.accuracy_score !== undefined ? String(Math.round(qs.accuracy_score * 100)) : "",
                      hallucination: qs?.hallucination_score !== undefined ? String(Math.round(qs.hallucination_score * 100)) : "",
                      resolution: qs?.resolution_score !== undefined ? String(Math.round(qs.resolution_score * 100)) : "",
                      escalation: qs?.escalation_score !== undefined ? String(Math.round(qs.escalation_score * 100)) : "",
                      tone: qs?.tone_score !== undefined ? String(Math.round(qs.tone_score * 100)) : "",
                      sentiment: qs?.sentiment_score !== undefined ? String(Math.round(qs.sentiment_score * 100)) : "",
                    })}>Start from current scores</GlassButton>
                    <GlassTextarea value={labelNotes} onChange={(e) => setLabelNotes(e.target.value)} className="min-h-[80px]" placeholder="Why are these labels correct?" />
                    <div className="flex gap-2">
                      <GlassButton size="sm" className="w-full" onClick={submitTrainingLabels} disabled={labelSetState === "saving"}>
                        {labelSetState === "saving" ? "Saving…" : "Save labels"}
                      </GlassButton>
                      <GlassButton size="sm" variant="ghost" className="w-full" onClick={() => setShowTrainingForm(false)}>Cancel</GlassButton>
                    </div>
                  </div>
                ) : (
                  <GlassButton size="sm" className="w-full" onClick={() => setShowTrainingForm(true)}>Save training label</GlassButton>
                )}
                {labelSetState === "saved" && <p className="mt-2 text-xs text-[#10B981]">Labels saved.</p>}
                {labelSetState === "error" && <p className="mt-2 text-xs text-[#EF4444]">Failed to save.</p>}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
