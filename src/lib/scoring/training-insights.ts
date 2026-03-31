import { supabaseAdmin } from "@/lib/supabase";
import { CALIBRATION_DIMENSIONS, getCalibrationExampleKind, getCalibrationShareScope, isGoldSetConversation } from "@/lib/calibration";
import { getLearnedCalibrationSummary } from "./calibration-model";

type DimensionKey = (typeof CALIBRATION_DIMENSIONS)[number]["key"];

type OverrideRow = {
  quality_score_id: string;
  dimension: string;
};

type QualityScoreRow = {
  id: string;
  conversation_id: string;
  overall_score: number;
  accuracy_score?: number | null;
  hallucination_score?: number | null;
  resolution_score?: number | null;
  confidence_level?: "high" | "medium" | "low" | null;
  flags?: string[] | null;
  summary?: string | null;
  created_at?: string | null;
};

type ConversationRow = {
  id: string;
  workspace_id: string;
  customer_identifier?: string | null;
  platform?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

function scoreForPriority(confidenceLevel?: string | null) {
  if (confidenceLevel === "low") return 0.45;
  if (confidenceLevel === "medium") return 0.22;
  return 0;
}

function deriveReason(score: QualityScoreRow, conversation: ConversationRow) {
  const flags = score.flags || [];
  if (flags.some((flag) => /grounding|verification|tool_backed|trace/i.test(flag))) {
    return "Helpful answer, but the transcript did not clearly prove the underlying claim.";
  }

  if (score.confidence_level === "low") {
    return "The scorer is not very sure about this conversation, so a human label would teach it quickly.";
  }

  if ((score.resolution_score ?? 0) >= 0.75 && (score.accuracy_score ?? 0) < 0.72) {
    return "This is a strong example of ‘useful but weakly grounded’ and helps separate quality from trust risk.";
  }

  if ((score.overall_score ?? 0) >= 0.45 && (score.overall_score ?? 0) <= 0.82) {
    return "Borderline conversations are high-value training examples because small label corrections matter most here.";
  }

  if (conversation.platform && conversation.platform !== "custom") {
    return `This gives the scorer more real coverage for ${conversation.platform} traffic.`;
  }

  return "This is a good candidate to improve the scorer’s judgment and future review coverage.";
}

export interface TrainingInsights {
  review_queue: Array<{
    conversation_id: string;
    customer_identifier?: string | null;
    platform?: string | null;
    created_at: string;
    overall_score: number;
    confidence_level: "high" | "medium" | "low";
    reason: string;
    priority_score: number;
  }>;
  label_coverage: {
    total_gold_set_conversations: number;
    real_examples: number;
    synthetic_examples: number;
    private_examples: number;
    shared_examples: number;
    dimensions: Array<{
      key: DimensionKey;
      label: string;
      label_count: number;
      healthy: boolean;
    }>;
  };
  roadmap: {
    next_workspace_label_milestone: number;
    next_shared_label_milestone: number;
    best_next_steps: string[];
  };
}

function nextMilestone(current: number, milestones: number[]) {
  return milestones.find((milestone) => milestone > current) || milestones[milestones.length - 1];
}

export async function getTrainingInsights(workspaceId: string): Promise<TrainingInsights> {
  const [overridesRes, scoresRes, conversationsRes, learnedSummary] = await Promise.all([
    supabaseAdmin
      .from("quality_overrides")
      .select("quality_score_id, dimension")
      .order("created_at", { ascending: false })
      .limit(6000),
    supabaseAdmin
      .from("quality_scores")
      .select("id, conversation_id, overall_score, accuracy_score, resolution_score, confidence_level, flags, summary")
      .order("scored_at", { ascending: false })
      .limit(1500),
    supabaseAdmin
      .from("conversations")
      .select("id, workspace_id, customer_identifier, platform, created_at, metadata")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(600),
    getLearnedCalibrationSummary(workspaceId),
  ]);

  const overrides = (overridesRes.data || []) as OverrideRow[];
  const scores = (scoresRes.data || []) as QualityScoreRow[];
  const conversations = (conversationsRes.data || []) as ConversationRow[];

  const qualityScoreIdSet = new Set(overrides.map((row) => row.quality_score_id));
  const conversationMap = new Map(conversations.map((conversation) => [conversation.id, conversation]));
  const goldSetConversations = conversations.filter((conversation) =>
    isGoldSetConversation((conversation.metadata as Record<string, unknown> | null) || null)
  );

  const dimensions = CALIBRATION_DIMENSIONS.map((dimension) => {
    const labelCount = overrides.filter((row) => row.dimension === dimension.key).length;
    return {
      key: dimension.key,
      label: dimension.label,
      label_count: labelCount,
      healthy: labelCount >= 12,
    };
  });

  const reviewQueue = scores
    .map((score) => {
      const conversation = conversationMap.get(score.conversation_id);
      if (!conversation) return null;

      const metadata = (conversation.metadata as Record<string, unknown> | null) || null;
      const alreadyGoldSet = isGoldSetConversation(metadata);
      const alreadyLabeled = qualityScoreIdSet.has(score.id);
      if (alreadyGoldSet || alreadyLabeled) return null;

      const confidenceLevel = (score.confidence_level || "low") as "high" | "medium" | "low";
      const flags = score.flags || [];
      let priorityScore = 0;

      priorityScore += scoreForPriority(confidenceLevel);
      if (flags.some((flag) => /grounding|verification|tool_backed|trace/i.test(flag))) priorityScore += 0.3;
      if (flags.length >= 3) priorityScore += 0.12;
      if (score.overall_score >= 0.45 && score.overall_score <= 0.82) priorityScore += 0.12;
      if ((score.resolution_score ?? 0) >= 0.75 && (score.accuracy_score ?? 0) < 0.72) priorityScore += 0.18;
      if ((conversation.platform || "custom") !== "custom") priorityScore += 0.08;

      return {
        conversation_id: conversation.id,
        customer_identifier: conversation.customer_identifier,
        platform: conversation.platform,
        created_at: conversation.created_at,
        overall_score: score.overall_score,
        confidence_level: confidenceLevel,
        reason: deriveReason(score, conversation),
        priority_score: Number(priorityScore.toFixed(2)),
      };
    })
    .filter(Boolean)
    .sort((left, right) => (right?.priority_score || 0) - (left?.priority_score || 0))
    .slice(0, 8) as TrainingInsights["review_queue"];

  const realExamples = goldSetConversations.filter((conversation) =>
    getCalibrationExampleKind((conversation.metadata as Record<string, unknown> | null) || null) === "real"
  ).length;
  const syntheticExamples = goldSetConversations.length - realExamples;
  const sharedExamples = goldSetConversations.filter((conversation) =>
    getCalibrationShareScope((conversation.metadata as Record<string, unknown> | null) || null) === "global_anonymous"
  ).length;
  const privateExamples = goldSetConversations.length - sharedExamples;

  const workspaceMilestone = nextMilestone(learnedSummary.workspace_private_labels, [30, 75, 150, 300]);
  const sharedMilestone = nextMilestone(learnedSummary.global_shared_labels, [50, 250, 1000, 2500]);
  const weakestDimensions = dimensions
    .filter((dimension) => !dimension.healthy)
    .sort((left, right) => left.label_count - right.label_count)
    .slice(0, 3)
    .map((dimension) => dimension.label.toLowerCase());

  const bestNextSteps: string[] = [];
  if (reviewQueue.length > 0) {
    bestNextSteps.push(`Label ${Math.min(5, reviewQueue.length)} high-value conversations from the review queue to improve the scorer fastest.`);
  }
  if (weakestDimensions.length > 0) {
    bestNextSteps.push(`Add more labeled examples for ${weakestDimensions.join(", ")} so coverage is balanced across the scorecard.`);
  }
  if (realExamples < syntheticExamples) {
    bestNextSteps.push("Shift the gold set toward more real conversations so the scorer learns production behavior, not just test cases.");
  }
  if (sharedExamples < Math.max(10, Math.round(goldSetConversations.length * 0.25))) {
    bestNextSteps.push("Opt a few safe examples into shared learning so the anonymized global model gets stronger faster.");
  }
  if (bestNextSteps.length === 0) {
    bestNextSteps.push("Keep labeling difficult edge cases and periodically review scorer regressions against the gold set.");
  }

  return {
    review_queue: reviewQueue,
    label_coverage: {
      total_gold_set_conversations: goldSetConversations.length,
      real_examples: realExamples,
      synthetic_examples: syntheticExamples,
      private_examples: privateExamples,
      shared_examples: sharedExamples,
      dimensions,
    },
    roadmap: {
      next_workspace_label_milestone: workspaceMilestone,
      next_shared_label_milestone: sharedMilestone,
      best_next_steps: bestNextSteps,
    },
  };
}
