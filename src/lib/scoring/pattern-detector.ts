/**
 * Pass 3: Pattern Aggregation — Zero API calls
 *
 * Detects recurring failure patterns across conversations using
 * algorithmic analysis. Groups low-scoring conversations by topic,
 * identifies knowledge gaps, escalation triggers, tone decay, and
 * resolution failures.
 *
 * Pattern types:
 *   topic_cluster       — multiple conversations struggling with same topic
 *   hallucination_cluster — repeated hallucinations about same subject
 *   escalation_trigger  — common triggers for human escalation
 *   tone_drift          — agent tone degrading over time
 *   resolution_failure  — recurring unresolved issue types
 *   score_anomaly       — sudden drops vs rolling average
 */

import type { QualityScore, FailurePattern, PromptImprovement, KnowledgeGap } from "@/lib/db/types";

interface ConversationWithScore {
  id: string;
  quality_score: QualityScore;
  platform: string;
  created_at: string;
}

// ─── Topic Clustering (keyword-based, zero embeddings) ───────────────
/**
 * Extracts topic keywords from a quality score's flags, claim failures,
 * and knowledge gaps. These keywords are used to cluster similar conversations.
 */
function extractTopicSignature(score: QualityScore): string[] {
  const topics: string[] = [];

  // Flags often encode topic info (e.g., "fabricated_pricing", "billing_error")
  for (const flag of score.flags || []) {
    if (flag.includes(":")) {
      topics.push(flag.split(":")[1]);
    } else {
      topics.push(flag);
    }
  }

  // Fabricated or contradicted claims signal topic areas
  for (const claim of score.claim_analysis || []) {
    if (claim.verdict === "fabricated" || claim.verdict === "contradicted") {
      const words = claim.claim.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      topics.push(...words.slice(0, 3));
    }
  }

  // Knowledge gaps are the clearest signal of topic problems
  for (const gap of score.knowledge_gaps || []) {
    topics.push(gap.topic.toLowerCase().trim());
  }

  return [...new Set(topics)];
}

function topicOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const intersection = b.filter((t) => setA.has(t));
  return intersection.length / Math.max(a.length, b.length);
}

// ─── Cluster Detection ─────────────────────────────────────────────
interface Cluster {
  conversations: ConversationWithScore[];
  topics: string[];
  avgScore: number;
  primaryIssue: string;
}

function clusterByTopic(conversations: ConversationWithScore[]): Cluster[] {
  const signatures = conversations.map((c) => ({
    conv: c,
    topics: extractTopicSignature(c.quality_score),
  }));

  const clusters: Cluster[] = [];
  const assigned = new Set<string>();

  for (const sig of signatures) {
    if (assigned.has(sig.conv.id) || sig.topics.length === 0) continue;

    const cluster: ConversationWithScore[] = [sig.conv];
    assigned.add(sig.conv.id);

    for (const other of signatures) {
      if (assigned.has(other.conv.id)) continue;
      if (topicOverlap(sig.topics, other.topics) > 0.3) {
        cluster.push(other.conv);
        assigned.add(other.conv.id);
      }
    }

    if (cluster.length >= 2) {
      const avgScore =
        cluster.reduce((s, c) => s + c.quality_score.overall_score, 0) / cluster.length;

      // Find the most common topic keyword across the cluster
      const topicCounts: Record<string, number> = {};
      cluster.forEach((c) => {
        extractTopicSignature(c.quality_score).forEach((t) => {
          topicCounts[t] = (topicCounts[t] || 0) + 1;
        });
      });
      const primaryIssue =
        Object.entries(topicCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "unknown";

      clusters.push({ conversations: cluster, topics: sig.topics, avgScore, primaryIssue });
    }
  }

  return clusters;
}

// ─── Time-Series Anomaly Detection ─────────────────────────────────
function detectScoreAnomalies(
  conversations: ConversationWithScore[],
  windowDays = 7
): { date: string; dimension: string; drop: number }[] {
  const anomalies: { date: string; dimension: string; drop: number }[] = [];

  const byDay = new Map<string, ConversationWithScore[]>();
  for (const c of conversations) {
    const day = c.created_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(c);
  }

  const days = [...byDay.keys()].sort();
  if (days.length < 3) return anomalies;

  const dimensions = [
    "overall_score",
    "accuracy_score",
    "hallucination_score",
    "resolution_score",
  ] as const;

  for (const dim of dimensions) {
    const dailyAvgs = days.map((day) => {
      const convs = byDay.get(day)!;
      const scores = convs
        .map((c) => c.quality_score[dim])
        .filter((s): s is number => s !== null && s !== undefined);
      return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    });

    for (let i = 2; i < dailyAvgs.length; i++) {
      const current = dailyAvgs[i];
      if (current === null) continue;

      const previous = dailyAvgs
        .slice(Math.max(0, i - windowDays), i)
        .filter((v): v is number => v !== null);
      if (previous.length < 2) continue;

      const rollingAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
      const drop = rollingAvg - current;

      if (drop > 0.15) {
        anomalies.push({
          date: days[i],
          dimension: dim.replace("_score", ""),
          drop: Math.round(drop * 100),
        });
      }
    }
  }

  return anomalies;
}

// ─── Tone Drift Detection ───────────────────────────────────────────
/**
 * Detects sustained degradation in tone_score over time.
 * Splits conversations into early (first 50%) vs recent (last 50%)
 * and flags if recent tone_score is meaningfully lower.
 *
 * Returns a pattern if: recent avg < early avg by ≥10% AND recent avg < 0.7
 */
function detectToneDrift(
  conversations: ConversationWithScore[]
): { driftPercent: number; recentAvg: number; earlyAvg: number; recentConvIds: string[] } | null {
  // Need at least 6 conversations for a meaningful comparison
  const withTone = conversations
    .filter((c) => c.quality_score.tone_score !== undefined && c.quality_score.tone_score !== null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  if (withTone.length < 6) return null;

  const mid = Math.floor(withTone.length / 2);
  const early = withTone.slice(0, mid);
  const recent = withTone.slice(mid);

  const earlyAvg = early.reduce((s, c) => s + (c.quality_score.tone_score ?? 0), 0) / early.length;
  const recentAvg = recent.reduce((s, c) => s + (c.quality_score.tone_score ?? 0), 0) / recent.length;

  const driftPercent = Math.round((earlyAvg - recentAvg) * 100);

  // Flag only if meaningful degradation AND recent score is below acceptable threshold
  if (driftPercent >= 10 && recentAvg < 0.7) {
    return {
      driftPercent,
      recentAvg,
      earlyAvg,
      recentConvIds: recent.map((c) => c.id),
    };
  }

  return null;
}

// ─── Resolution Failure Detection ──────────────────────────────────
/**
 * Identifies recurring topics where the agent consistently fails to resolve issues.
 * Clusters low-resolution-score conversations by conversation_type from structural metrics.
 * Flags types with ≥3 conversations averaging below 0.5 resolution_score.
 */
function detectResolutionFailures(
  conversations: ConversationWithScore[]
): { type: string; count: number; avgResolution: number; convIds: string[] }[] {
  const byType = new Map<
    string,
    { convIds: string[]; resolutionScores: number[] }
  >();

  for (const c of conversations) {
    const resScore = c.quality_score.resolution_score;
    if (resScore === undefined || resScore === null) continue;

    // Get conversation type from structural metrics (set during Pass 1)
    const convType =
      (c.quality_score.structural_metrics?.conversation_type as string | undefined) || "general";

    if (!byType.has(convType)) {
      byType.set(convType, { convIds: [], resolutionScores: [] });
    }

    byType.get(convType)!.convIds.push(c.id);
    byType.get(convType)!.resolutionScores.push(resScore);
  }

  const failures: { type: string; count: number; avgResolution: number; convIds: string[] }[] = [];

  for (const [type, { convIds, resolutionScores }] of byType) {
    if (convIds.length < 3) continue; // need minimum 3 to flag a pattern

    const avgResolution =
      resolutionScores.reduce((a, b) => a + b, 0) / resolutionScores.length;

    if (avgResolution < 0.5) {
      failures.push({ type, count: convIds.length, avgResolution, convIds });
    }
  }

  // Sort by worst avg resolution first
  return failures.sort((a, b) => a.avgResolution - b.avgResolution);
}

// ─── Aggregate Prompt Improvements ─────────────────────────────────
export function aggregatePromptImprovements(
  conversations: ConversationWithScore[]
): PromptImprovement[] {
  const improvementMap = new Map<string, { improvement: PromptImprovement; count: number }>();

  for (const conv of conversations) {
    for (const imp of conv.quality_score.prompt_improvements || []) {
      const key = imp.issue.toLowerCase().trim();
      if (improvementMap.has(key)) {
        improvementMap.get(key)!.count++;
      } else {
        improvementMap.set(key, { improvement: imp, count: 1 });
      }
    }
  }

  return [...improvementMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(({ improvement }) => improvement);
}

// ─── Aggregate Knowledge Gaps ───────────────────────────────────────
export function aggregateKnowledgeGaps(
  conversations: ConversationWithScore[]
): KnowledgeGap[] {
  const gapMap = new Map<string, KnowledgeGap>();

  for (const conv of conversations) {
    for (const gap of conv.quality_score.knowledge_gaps || []) {
      const key = gap.topic.toLowerCase().trim();
      if (gapMap.has(key)) {
        gapMap.get(key)!.affected_conversations++;
      } else {
        gapMap.set(key, { ...gap });
      }
    }
  }

  return [...gapMap.values()].sort(
    (a, b) => b.affected_conversations - a.affected_conversations
  );
}

// ─── Main Pattern Detection ─────────────────────────────────────────
/**
 * Detects all failure pattern types across a set of scored conversations.
 * Returns an array of FailurePattern objects (without workspace_id set —
 * the caller must set workspace_id before persisting).
 */
export function detectPatterns(
  conversations: ConversationWithScore[]
): Omit<FailurePattern, "workspace_id">[] {
  const patterns: Omit<FailurePattern, "workspace_id">[] = [];

  const now = new Date().toISOString();

  // Only analyze conversations that have scores
  const scored = conversations.filter((c) => c.quality_score?.overall_score !== undefined);
  const lowScoring = scored.filter((c) => c.quality_score.overall_score < 0.6);

  // ── 1. Topic Clusters ──────────────────────────────────────────
  const clusters = clusterByTopic(lowScoring);
  for (const cluster of clusters) {
    const promptImprovements = aggregatePromptImprovements(cluster.conversations);
    const knowledgeGaps = aggregateKnowledgeGaps(cluster.conversations);

    const severity =
      cluster.avgScore < 0.3 ? "critical"
      : cluster.avgScore < 0.45 ? "high"
      : cluster.conversations.length > 5 ? "high"
      : "medium";

    patterns.push({
      id: crypto.randomUUID(),
      pattern_type: "topic_cluster",
      title: `Recurring issues with "${cluster.primaryIssue}"`,
      description:
        `${cluster.conversations.length} conversations about "${cluster.primaryIssue}" ` +
        `averaged ${(cluster.avgScore * 100).toFixed(0)}% quality. This indicates a ` +
        `systematic gap in the agent's knowledge or prompting.`,
      affected_conversation_ids: cluster.conversations.map((c) => c.id),
      severity,
      recommendation:
        promptImprovements[0]?.recommended_prompt_change ||
        `Review and update the agent's system prompt to cover "${cluster.primaryIssue}" more explicitly.`,
      prompt_fix: promptImprovements[0]?.recommended_prompt_change,
      knowledge_base_suggestion: knowledgeGaps[0]?.suggested_content,
      detected_at: now,
      is_resolved: false,
    });
  }

  // ── 2. Hallucination Clusters ──────────────────────────────────
  const hallucinations = scored.filter(
    (c) =>
      c.quality_score.hallucination_score !== undefined &&
      c.quality_score.hallucination_score < 0.5
  );

  if (hallucinations.length >= 3) {
    // Find what topics the hallucinations are about
    const allGaps = aggregateKnowledgeGaps(hallucinations);
    const topicHint =
      allGaps[0]?.topic ? ` Most frequently about: "${allGaps[0].topic}".` : "";

    patterns.push({
      id: crypto.randomUUID(),
      pattern_type: "hallucination_cluster",
      title: `Hallucination spike: ${hallucinations.length} conversations with fabricated information`,
      description:
        `${hallucinations.length} conversations scored below 50% on hallucination prevention.${topicHint} ` +
        `The agent is fabricating information rather than saying it doesn't know.`,
      affected_conversation_ids: hallucinations.map((c) => c.id),
      severity: "critical",
      recommendation:
        "Add an explicit anti-hallucination instruction to the agent's system prompt.",
      prompt_fix:
        "Add to system prompt: 'CRITICAL RULE: Never fabricate, invent, or guess information. " +
        "If you don't have accurate information about something — a price, a policy, a feature, " +
        "a timeline — say clearly: \"I don't have that information and want to make sure I give " +
        "you accurate details. Let me connect you with someone who can confirm this.\" It is " +
        "always better to acknowledge uncertainty than to provide incorrect information.'",
      knowledge_base_suggestion: allGaps[0]?.suggested_content,
      detected_at: now,
      is_resolved: false,
    });
  }

  // ── 3. Escalation Triggers ─────────────────────────────────────
  const escalations = scored.filter(
    (c) =>
      c.quality_score.structural_metrics?.escalation_turn !== undefined
  );

  if (escalations.length >= 3) {
    const earlyEscalations = escalations.filter(
      (c) => (c.quality_score.structural_metrics?.escalation_turn ?? 99) <= 3
    );

    if (earlyEscalations.length >= 2) {
      patterns.push({
        id: crypto.randomUUID(),
        pattern_type: "escalation_trigger",
        title: `Early escalation: ${earlyEscalations.length} customers requested a human within 3 messages`,
        description:
          `Customers are requesting human agents very early in conversations. This suggests ` +
          `the agent isn't establishing credibility or addressing the core issue quickly enough.`,
        affected_conversation_ids: earlyEscalations.map((c) => c.id),
        severity: earlyEscalations.length > 5 ? "high" : "medium",
        recommendation:
          "Revise the agent's opening message to immediately acknowledge the specific issue " +
          "and demonstrate capability before asking clarifying questions.",
        prompt_fix:
          "Add to system prompt: 'When starting a conversation, first acknowledge the customer's " +
          "specific issue directly (e.g., \"I can help you with your billing question right now.\"). " +
          "Then outline the steps you will take. This builds confidence that you can resolve the " +
          "issue before the customer considers escalating.'",
        knowledge_base_suggestion: undefined,
        detected_at: now,
        is_resolved: false,
      });
    }
  }

  // ── 4. Tone Drift ──────────────────────────────────────────────
  const toneDrift = detectToneDrift(scored);
  if (toneDrift) {
    patterns.push({
      id: crypto.randomUUID(),
      pattern_type: "tone_drift",
      title: `Tone degradation: ${toneDrift.driftPercent}% drop over time (recent avg: ${(toneDrift.recentAvg * 100).toFixed(0)}%)`,
      description:
        `The agent's tone score has declined by ${toneDrift.driftPercent} percentage points ` +
        `compared to earlier conversations. Early avg: ${(toneDrift.earlyAvg * 100).toFixed(0)}%, ` +
        `recent avg: ${(toneDrift.recentAvg * 100).toFixed(0)}%. ` +
        `This may indicate prompt drift, model updates, or new conversation types being handled.`,
      affected_conversation_ids: toneDrift.recentConvIds,
      severity: toneDrift.driftPercent >= 20 ? "high" : "medium",
      recommendation:
        "Review recent conversations for tone issues. Consider reinforcing tone guidelines " +
        "in the system prompt, particularly for handling frustrated customers.",
      prompt_fix:
        "Strengthen tone guidance in system prompt: 'Always maintain a warm, professional, " +
        "and empathetic tone regardless of the customer's frustration level. Use the customer's " +
        "name when possible. Avoid robotic or formulaic language. Never be dismissive. " +
        "Phrases like \"I understand this is frustrating\" and \"Let me help you sort this out\" " +
        "are always appropriate when the customer is upset.'",
      knowledge_base_suggestion: undefined,
      detected_at: now,
      is_resolved: false,
    });
  }

  // ── 5. Resolution Failures ─────────────────────────────────────
  const resolutionFailures = detectResolutionFailures(lowScoring);
  for (const failure of resolutionFailures) {
    const avgPct = (failure.avgResolution * 100).toFixed(0);
    patterns.push({
      id: crypto.randomUUID(),
      pattern_type: "resolution_failure",
      title: `Resolution failure in ${failure.type} conversations (avg ${avgPct}% resolution)`,
      description:
        `${failure.count} ${failure.type} conversations averaged only ${avgPct}% resolution rate. ` +
        `The agent is consistently failing to fully resolve issues in this category. ` +
        `This likely indicates missing procedures, incorrect information, or insufficient KB coverage.`,
      affected_conversation_ids: failure.convIds,
      severity: failure.avgResolution < 0.3 ? "critical" : "high",
      recommendation:
        `Create step-by-step resolution procedures for ${failure.type} issues in the knowledge base, ` +
        `and add explicit instructions to the system prompt about when and how to escalate ` +
        `${failure.type} issues that the agent cannot resolve.`,
      prompt_fix:
        `Add to system prompt: 'For ${failure.type} issues, follow this resolution approach: ` +
        `(1) Confirm you understand the exact issue, (2) Check your knowledge base for the correct ` +
        `procedure, (3) Execute the solution or clearly explain what the customer needs to do, ` +
        `(4) Confirm the issue is resolved before closing. If you cannot resolve a ${failure.type} ` +
        `issue within 5 exchanges, escalate with full context.'`,
      knowledge_base_suggestion:
        `Create a "${failure.type} Resolution Playbook" KB article with step-by-step procedures ` +
        `for common ${failure.type} scenarios, including escalation criteria and required information.`,
      detected_at: now,
      is_resolved: false,
    });
  }

  // ── 6. Score Anomalies (time-series drops) ─────────────────────
  const anomalies = detectScoreAnomalies(scored);
  for (const anomaly of anomalies) {
    patterns.push({
      id: crypto.randomUUID(),
      pattern_type: "score_anomaly",
      title: `${anomaly.dimension} score dropped ${anomaly.drop}% on ${anomaly.date}`,
      description:
        `The ${anomaly.dimension} score dropped ${anomaly.drop} percentage points on ${anomaly.date}, ` +
        `significantly below the rolling average. This may correlate with a KB update, ` +
        `prompt change, model update, or new issue type the agent wasn't prepared for.`,
      affected_conversation_ids: [],
      severity: anomaly.drop > 25 ? "high" : "medium",
      recommendation:
        `Investigate what changed on or before ${anomaly.date}: ` +
        `knowledge base updates, system prompt modifications, new product launches, ` +
        `or seasonal support volume shifts that the agent isn't equipped to handle.`,
      prompt_fix: undefined,
      knowledge_base_suggestion: undefined,
      detected_at: now,
      is_resolved: false,
    });
  }

  return patterns;
}

// ─── Named exports for direct use ──────────────────────────────────
export { detectScoreAnomalies, detectToneDrift, detectResolutionFailures };
