/**
 * Pass 3: Pattern Aggregation — Zero API calls
 *
 * Detects recurring failure patterns across conversations using
 * algorithmic analysis. Groups low-scoring conversations by topic,
 * identifies knowledge gaps, and detects anomalies.
 */

import type { QualityScore, FailurePattern, PromptImprovement, KnowledgeGap } from "@/lib/db/types";

interface ConversationWithScore {
  id: string;
  quality_score: QualityScore;
  platform: string;
  created_at: string;
}

// ─── Topic Clustering (keyword-based, no embeddings needed) ────────
function extractTopicSignature(score: QualityScore): string[] {
  const topics: string[] = [];

  // Extract from flags
  if (score.flags) {
    for (const flag of score.flags) {
      if (flag.includes(":")) {
        topics.push(flag.split(":")[1]);
      } else {
        topics.push(flag);
      }
    }
  }

  // Extract from claim analysis
  if (score.claim_analysis) {
    for (const claim of score.claim_analysis) {
      if (claim.verdict === "fabricated" || claim.verdict === "contradicted") {
        // Extract key nouns from the claim
        const words = claim.claim.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        topics.push(...words.slice(0, 3));
      }
    }
  }

  // Extract from knowledge gaps
  if (score.knowledge_gaps) {
    for (const gap of score.knowledge_gaps) {
      topics.push(gap.topic.toLowerCase());
    }
  }

  return [...new Set(topics)];
}

function topicOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const intersection = b.filter(t => setA.has(t));
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
  const signatures = conversations.map(c => ({
    conv: c,
    topics: extractTopicSignature(c.quality_score),
  }));

  const clusters: Cluster[] = [];
  const assigned = new Set<string>();

  for (const sig of signatures) {
    if (assigned.has(sig.conv.id) || sig.topics.length === 0) continue;

    const cluster: ConversationWithScore[] = [sig.conv];
    assigned.add(sig.conv.id);

    // Find similar conversations
    for (const other of signatures) {
      if (assigned.has(other.conv.id)) continue;
      if (topicOverlap(sig.topics, other.topics) > 0.3) {
        cluster.push(other.conv);
        assigned.add(other.conv.id);
      }
    }

    if (cluster.length >= 2) {
      const avgScore = cluster.reduce((s, c) => s + c.quality_score.overall_score, 0) / cluster.length;

      // Find most common topic
      const topicCounts: Record<string, number> = {};
      cluster.forEach(c => {
        extractTopicSignature(c.quality_score).forEach(t => {
          topicCounts[t] = (topicCounts[t] || 0) + 1;
        });
      });
      const primaryIssue = Object.entries(topicCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || "unknown";

      clusters.push({
        conversations: cluster,
        topics: sig.topics,
        avgScore,
        primaryIssue,
      });
    }
  }

  return clusters;
}

// ─── Time-Series Anomaly Detection ─────────────────────────────────
function detectScoreAnomalies(
  conversations: ConversationWithScore[],
  windowDays: number = 7
): { date: string; dimension: string; drop: number }[] {
  const anomalies: { date: string; dimension: string; drop: number }[] = [];

  // Group by day
  const byDay = new Map<string, ConversationWithScore[]>();
  for (const c of conversations) {
    const day = c.created_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(c);
  }

  const days = [...byDay.keys()].sort();
  if (days.length < 3) return anomalies;

  // Calculate rolling average
  const dimensions = ["overall_score", "accuracy_score", "hallucination_score", "resolution_score"] as const;

  for (const dim of dimensions) {
    const dailyAvgs = days.map(day => {
      const convs = byDay.get(day)!;
      const scores = convs
        .map(c => c.quality_score[dim])
        .filter((s): s is number => s !== null && s !== undefined);
      return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    });

    // Detect sudden drops (> 15% below rolling average)
    for (let i = 2; i < dailyAvgs.length; i++) {
      const current = dailyAvgs[i];
      if (current === null) continue;

      const previous = dailyAvgs.slice(Math.max(0, i - windowDays), i).filter((v): v is number => v !== null);
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

// ─── Aggregate Prompt Improvements ─────────────────────────────────
function aggregatePromptImprovements(conversations: ConversationWithScore[]): PromptImprovement[] {
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

  // Sort by frequency, return top improvements
  return [...improvementMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(({ improvement }) => improvement);
}

// ─── Aggregate Knowledge Gaps ──────────────────────────────────────
function aggregateKnowledgeGaps(conversations: ConversationWithScore[]): KnowledgeGap[] {
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

  return [...gapMap.values()].sort((a, b) => b.affected_conversations - a.affected_conversations);
}

// ─── Main Pattern Detection ────────────────────────────────────────
export function detectPatterns(conversations: ConversationWithScore[]): FailurePattern[] {
  const patterns: FailurePattern[] = [];

  // Only analyze low-scoring conversations for failure patterns
  const lowScoring = conversations.filter(c => c.quality_score.overall_score < 0.6);

  if (lowScoring.length === 0) return patterns;

  // 1. Topic clusters
  const clusters = clusterByTopic(lowScoring);
  for (const cluster of clusters) {
    const promptImprovements = aggregatePromptImprovements(cluster.conversations);
    const knowledgeGaps = aggregateKnowledgeGaps(cluster.conversations);

    const severity = cluster.avgScore < 0.3
      ? "critical"
      : cluster.avgScore < 0.45
      ? "high"
      : cluster.conversations.length > 5
      ? "high"
      : "medium";

    patterns.push({
      id: crypto.randomUUID(),
      workspace_id: "",
      pattern_type: "topic_cluster",
      title: `Recurring issues with "${cluster.primaryIssue}"`,
      description: `${cluster.conversations.length} conversations about "${cluster.primaryIssue}" scored an average of ${(cluster.avgScore * 100).toFixed(0)}%. This indicates a systematic issue.`,
      affected_conversation_ids: cluster.conversations.map(c => c.id),
      severity,
      recommendation: promptImprovements[0]?.recommended_prompt_change || "Review agent prompts for this topic area.",
      prompt_fix: promptImprovements[0]?.recommended_prompt_change,
      knowledge_base_suggestion: knowledgeGaps[0]?.suggested_content,
      detected_at: new Date().toISOString(),
      is_resolved: false,
    });
  }

  // 2. Hallucination patterns
  const hallucinations = lowScoring.filter(
    c => c.quality_score.hallucination_score !== undefined && c.quality_score.hallucination_score < 0.5
  );
  if (hallucinations.length >= 3) {
    patterns.push({
      id: crypto.randomUUID(),
      workspace_id: "",
      pattern_type: "hallucination_cluster",
      title: `Hallucination spike: ${hallucinations.length} conversations with fabricated information`,
      description: `${hallucinations.length} conversations contained significant hallucinations. Common fabricated claims should be addressed in the agent's system prompt.`,
      affected_conversation_ids: hallucinations.map(c => c.id),
      severity: "critical",
      recommendation: "Add explicit instructions to the agent's system prompt: 'Never fabricate information. If you don't know the answer, say so clearly and offer to escalate.'",
      prompt_fix: "Add to system prompt: 'IMPORTANT: Never make up information, policies, or procedures. If you are unsure about something, tell the customer you need to verify and will follow up. It is always better to be honest about uncertainty than to provide incorrect information.'",
      knowledge_base_suggestion: undefined,
      detected_at: new Date().toISOString(),
      is_resolved: false,
    });
  }

  // 3. Escalation patterns
  const escalations = conversations.filter(
    c =>
      c.quality_score.structural_metrics &&
      c.quality_score.structural_metrics.escalation_turn !== undefined
  );
  if (escalations.length >= 3) {
    const earlyEscalations = escalations.filter(
      c => (c.quality_score.structural_metrics?.escalation_turn || 99) <= 3
    );

    if (earlyEscalations.length >= 2) {
      patterns.push({
        id: crypto.randomUUID(),
        workspace_id: "",
        pattern_type: "escalation_trigger",
        title: `Early escalation pattern: ${earlyEscalations.length} customers asked for human within 3 messages`,
        description: `Customers are requesting human agents very early in conversations. This suggests the agent isn't building confidence or addressing concerns quickly enough.`,
        affected_conversation_ids: earlyEscalations.map(c => c.id),
        severity: earlyEscalations.length > 5 ? "high" : "medium",
        recommendation: "Improve the agent's opening message to set expectations and demonstrate competence immediately.",
        prompt_fix: "Add to system prompt: 'Begin each conversation by acknowledging the customer's issue specifically and outlining the steps you'll take to resolve it. This builds confidence that you can help.'",
        knowledge_base_suggestion: undefined,
        detected_at: new Date().toISOString(),
        is_resolved: false,
      });
    }
  }

  // 4. Score anomalies over time
  const anomalies = detectScoreAnomalies(conversations);
  for (const anomaly of anomalies) {
    patterns.push({
      id: crypto.randomUUID(),
      workspace_id: "",
      pattern_type: "score_anomaly",
      title: `${anomaly.dimension} dropped ${anomaly.drop}% on ${anomaly.date}`,
      description: `The ${anomaly.dimension} score dropped significantly on ${anomaly.date}. This may correlate with a knowledge base update, prompt change, or new issue type.`,
      affected_conversation_ids: [],
      severity: anomaly.drop > 25 ? "high" : "medium",
      recommendation: `Check what changed on or before ${anomaly.date} — knowledge base updates, prompt modifications, or new product launches that the agent isn't prepared for.`,
      prompt_fix: undefined,
      knowledge_base_suggestion: undefined,
      detected_at: new Date().toISOString(),
      is_resolved: false,
    });
  }

  return patterns;
}

export { aggregatePromptImprovements, aggregateKnowledgeGaps, detectScoreAnomalies };
