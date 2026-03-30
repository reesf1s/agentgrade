import { supabaseAdmin } from "@/lib/supabase";
import { getWorkspaceContext } from "@/lib/workspace";
import type {
  Alert,
  FailurePattern,
  KnowledgeGap,
  OrgRecommendation,
  PromptImprovement,
  QualityScore,
  WeeklyReportSummary,
} from "@/lib/db/types";
import { buildOrgRecommendations } from "@/lib/scoring/org-recommendations";
import { isManualCalibrationConversation } from "@/lib/calibration";
import { dedupeFailurePatterns } from "@/lib/patterns/normalize";
import {
  filterPatternsWithUsableScores,
  isAggregateEligibleScore,
} from "@/lib/scoring/quality-score-status";

export interface DashboardStats {
  avg_score: number;
  conversations_scored: number;
  hallucination_rate: number;
  escalation_rate: number;
}

export interface DashboardConversationRow {
  id: string;
  customer_identifier?: string;
  platform: string;
  was_escalated: boolean;
  created_at: string;
  quality_scores?: {
    overall_score: number;
    hallucination_score?: number;
    flags?: string[];
    summary?: string;
  } | null;
}

export interface DashboardTrendPoint {
  date: string;
  overall: number;
}

export interface DashboardData {
  stats: DashboardStats;
  conversations: DashboardConversationRow[];
  alerts: Alert[];
  patterns: FailurePattern[];
  trend_data: DashboardTrendPoint[];
}

export interface ReportData {
  week_start: string;
  week_end: string;
  summary: WeeklyReportSummary;
  alerts: Alert[];
  patterns: FailurePattern[];
  organization_recommendations: OrgRecommendation[];
  trend_data: Array<{ date: string; overall: number; accuracy?: number; hallucination?: number }>;
}

export interface BenchmarkStats {
  avg_score: number | null;
  total_scored: number;
}

function getJoinedRecord<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

async function loadUsableScoreMap(conversationIds: string[]) {
  const { data } = await supabaseAdmin
    .from("ag_quality_scores")
    .select("conversation_id, overall_score, flags, claim_analysis, confidence_level, structural_metrics, scoring_model_version")
    .in("conversation_id", conversationIds);

  const map = new Map<string, boolean>();

  for (const row of data || []) {
    map.set(
      row.conversation_id as string,
      isAggregateEligibleScore(
        row as {
          overall_score?: number;
          flags?: string[] | null;
          claim_analysis?: QualityScore["claim_analysis"];
          confidence_level?: "high" | "medium" | "low";
          scoring_model_version?: string | null;
          structural_metrics?: { confidence_level?: "high" | "medium" | "low" };
        }
      )
    );
  }

  return map;
}

export async function getCurrentWorkspaceId(): Promise<string> {
  const ctx = await getWorkspaceContext();
  if (!ctx?.workspace.id) {
    throw new Error("Unauthorized");
  }
  return ctx.workspace.id;
}

export async function loadDashboardData(workspaceId: string): Promise<DashboardData> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [conversationsRes, alertsRes, trendRes, patternsRes] = await Promise.all([
    supabaseAdmin
      .from("ag_conversations")
      .select("*, quality_scores:ag_quality_scores(*)")
      .eq("workspace_id", workspaceId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("ag_alerts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("acknowledged_at", null)
      .order("triggered_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("ag_conversations")
      .select("created_at, metadata, quality_scores:ag_quality_scores(overall_score, flags, confidence_level, structural_metrics, scoring_model_version)")
      .eq("workspace_id", workspaceId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("ag_failure_patterns")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_resolved", false)
      .order("detected_at", { ascending: false })
      .limit(25),
  ]);

  const conversations = ((conversationsRes.data || []) as DashboardConversationRow[])
    .filter(
      (conversation) => !isManualCalibrationConversation((conversation as { metadata?: Record<string, unknown> }).metadata || null)
    )
    .map((conversation) => {
      const qualityScore = getJoinedRecord(conversation.quality_scores);
      return {
        ...conversation,
        quality_scores: isAggregateEligibleScore(qualityScore) ? qualityScore : null,
      };
    });
  const alerts = (alertsRes.data || []) as Alert[];
  const patterns = (
    await filterPatternsWithUsableScores(
      dedupeFailurePatterns((patternsRes.data || []) as FailurePattern[]),
      loadUsableScoreMap
    )
  ).slice(0, 5);
  const scored = conversations.filter(
    (conversation) => isAggregateEligibleScore(getJoinedRecord(conversation.quality_scores))
  );

  const avgScore =
    scored.length > 0
      ? scored.reduce(
          (sum, conversation) =>
            sum + (getJoinedRecord(conversation.quality_scores)?.overall_score || 0),
          0
        ) / scored.length
      : 0;

  const hallucinationRate =
    scored.length > 0
      ? scored.filter((conversation) => {
          const hallucinationScore =
            getJoinedRecord(conversation.quality_scores)?.hallucination_score;
          return hallucinationScore !== undefined && hallucinationScore < 0.5;
        }).length / scored.length
      : 0;

  const escalationRate =
    conversations.length > 0
      ? conversations.filter((conversation) => conversation.was_escalated).length /
        conversations.length
      : 0;

  const trendByDay: Record<string, number[]> = {};
  for (const conversation of trendRes.data || []) {
    if (isManualCalibrationConversation((conversation.metadata as Record<string, unknown> | null) || null)) {
      continue;
    }
    const day = conversation.created_at.slice(0, 10);
    const qualityScore = getJoinedRecord(
      conversation.quality_scores as
        | { overall_score?: number }
        | { overall_score?: number }[]
        | null
    );
    if (isAggregateEligibleScore(qualityScore)) {
      if (!trendByDay[day]) trendByDay[day] = [];
      const safeQualityScore = qualityScore as { overall_score: number };
      const overallScore = safeQualityScore.overall_score;
      trendByDay[day].push(overallScore);
    }
  }

  return {
    stats: {
      avg_score: avgScore,
      conversations_scored: scored.length,
      hallucination_rate: hallucinationRate,
      escalation_rate: escalationRate,
    },
    conversations,
    alerts,
    patterns,
    trend_data: Object.entries(trendByDay)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, scores]) => ({
        date,
        overall: scores.reduce((sum, value) => sum + value, 0) / scores.length,
      })),
  };
}

export async function loadPatternsData(workspaceId: string): Promise<FailurePattern[]> {
  const { data, error } = await supabaseAdmin
    .from("ag_failure_patterns")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_resolved", false)
    .order("detected_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch patterns: ${error.message}`);
  }

  return filterPatternsWithUsableScores(
    dedupeFailurePatterns((data || []) as FailurePattern[]),
    loadUsableScoreMap
  );
}

export async function loadReportData(workspaceId: string): Promise<ReportData> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [thisWeekRes, lastWeekRes, trendRes, alertsRes, patternsRes] = await Promise.all([
    supabaseAdmin
      .from("ag_conversations")
      .select("*, quality_scores:ag_quality_scores(*)")
      .eq("workspace_id", workspaceId)
      .gte("created_at", sevenDaysAgo.toISOString()),
    supabaseAdmin
      .from("ag_conversations")
      .select("metadata, quality_scores:ag_quality_scores(overall_score, flags, confidence_level, structural_metrics, scoring_model_version)")
      .eq("workspace_id", workspaceId)
      .gte("created_at", fourteenDaysAgo.toISOString())
      .lt("created_at", sevenDaysAgo.toISOString()),
    supabaseAdmin
      .from("ag_conversations")
      .select("created_at, metadata, quality_scores:ag_quality_scores(overall_score, accuracy_score, hallucination_score, resolution_score, flags, confidence_level, structural_metrics, scoring_model_version)")
      .eq("workspace_id", workspaceId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("ag_alerts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("triggered_at", sevenDaysAgo.toISOString())
      .order("triggered_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("ag_failure_patterns")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_resolved", false)
      .order("detected_at", { ascending: false })
      .limit(25),
  ]);

  const thisWeek = (thisWeekRes.data || []).filter(
    (conversation) => !isManualCalibrationConversation((conversation.metadata as Record<string, unknown> | null) || null)
  );
  const lastWeek = (lastWeekRes.data || []).filter(
    (conversation) => !isManualCalibrationConversation((conversation.metadata as Record<string, unknown> | null) || null)
  );
  const scored = thisWeek.filter((conversation) =>
    isAggregateEligibleScore(
      getJoinedRecord(
        conversation.quality_scores as
          | { overall_score?: number; flags?: string[] | null }
          | { overall_score?: number; flags?: string[] | null }[]
          | null
      )
    )
  );

  const avgScore =
    scored.length > 0
      ? scored.reduce(
          (sum, conversation) =>
            sum +
              (getJoinedRecord(
                conversation.quality_scores as
                  | { overall_score: number }
                  | { overall_score: number }[]
                  | null
              )?.overall_score || 0),
          0
        ) / scored.length
      : 0;

  const lastWeekScored = lastWeek.filter((conversation) =>
    isAggregateEligibleScore(
      getJoinedRecord(
        conversation.quality_scores as
          | { overall_score?: number; flags?: string[] | null }
          | { overall_score?: number; flags?: string[] | null }[]
          | null
      )
    )
  );

  const lastWeekAvg =
    lastWeekScored.length > 0
      ? lastWeekScored.reduce(
          (sum, conversation) =>
            sum +
              (getJoinedRecord(
                conversation.quality_scores as
                  | { overall_score: number }
                  | { overall_score: number }[]
                  | null
              )?.overall_score || 0),
          0
        ) / lastWeekScored.length
      : 0;

  const hallucinationCount = scored.filter((conversation) => {
    const qualityScore = getJoinedRecord(
      conversation.quality_scores as
        | { hallucination_score?: number }
        | { hallucination_score?: number }[]
        | null
    );
    return (
      qualityScore?.hallucination_score !== undefined &&
      qualityScore.hallucination_score < 0.5
    );
  }).length;

  const escalationCount = thisWeek.filter((conversation) => conversation.was_escalated).length;

  const improvementMap = new Map<string, { improvement: PromptImprovement; count: number }>();
  const gapMap = new Map<string, KnowledgeGap & { count: number }>();

  for (const conversation of scored) {
    const qualityScore = getJoinedRecord(
      conversation.quality_scores as
        | {
            prompt_improvements?: PromptImprovement[];
            knowledge_gaps?: KnowledgeGap[];
          }
        | {
            prompt_improvements?: PromptImprovement[];
            knowledge_gaps?: KnowledgeGap[];
          }[]
        | null
    );

    for (const improvement of qualityScore?.prompt_improvements || []) {
      const key = improvement.issue.toLowerCase();
      if (improvementMap.has(key)) improvementMap.get(key)!.count += 1;
      else improvementMap.set(key, { improvement, count: 1 });
    }

    for (const gap of qualityScore?.knowledge_gaps || []) {
      const key = gap.topic.toLowerCase();
      if (gapMap.has(key)) gapMap.get(key)!.count += 1;
      else gapMap.set(key, { ...gap, count: 1 });
    }
  }

  const promptImprovements = [...improvementMap.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)
    .map(({ improvement }) => improvement);

  const knowledgeGaps = [...gapMap.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)
    .map(({ count, ...gap }) => {
      void count;
      return gap;
    });

  const worstConversations = scored
    .filter((conversation) => conversation.quality_scores)
    .sort((left, right) => {
      const leftScore =
        getJoinedRecord(
          left.quality_scores as
            | { overall_score: number }
            | { overall_score: number }[]
            | null
        )?.overall_score || 0;
      const rightScore =
        getJoinedRecord(
          right.quality_scores as
            | { overall_score: number }
            | { overall_score: number }[]
            | null
        )?.overall_score || 0;
      return leftScore - rightScore;
    })
    .slice(0, 5)
    .map((conversation) => ({
      conversation_id: conversation.id,
      score:
        getJoinedRecord(
          conversation.quality_scores as
            | { overall_score: number }
            | { overall_score: number }[]
            | null
        )?.overall_score || 0,
      summary:
        getJoinedRecord(
          conversation.quality_scores as
            | { summary?: string }
            | { summary?: string }[]
            | null
        )?.summary || "No summary available",
    }));

  const trendByDay: Record<string, { overall: number[]; accuracy: number[]; hallucination: number[] }> = {};
  for (const conversation of trendRes.data || []) {
    if (isManualCalibrationConversation((conversation.metadata as Record<string, unknown> | null) || null)) {
      continue;
    }
    const day = conversation.created_at.slice(0, 10);
    const qualityScore = getJoinedRecord(
      conversation.quality_scores as
        | {
            overall_score?: number;
            accuracy_score?: number;
            hallucination_score?: number;
          }
        | {
            overall_score?: number;
            accuracy_score?: number;
            hallucination_score?: number;
          }[]
        | null
    );

    if (isAggregateEligibleScore(qualityScore)) {
      if (!trendByDay[day]) {
        trendByDay[day] = { overall: [], accuracy: [], hallucination: [] };
      }
      const safeQualityScore = qualityScore as { overall_score: number; accuracy_score?: number; hallucination_score?: number };
      const overallScore = safeQualityScore.overall_score;
      trendByDay[day].overall.push(overallScore);
      if (safeQualityScore.accuracy_score !== undefined) {
        trendByDay[day].accuracy.push(safeQualityScore.accuracy_score);
      }
      if (safeQualityScore.hallucination_score !== undefined) {
        trendByDay[day].hallucination.push(safeQualityScore.hallucination_score);
      }
    }
  }

  const averageFor = (
    dimension: "accuracy_score" | "hallucination_score" | "resolution_score"
  ) => {
    const values = scored
      .map(
        (conversation) =>
          getJoinedRecord(
            conversation.quality_scores as
              | Record<string, number | undefined>
              | Record<string, number | undefined>[]
              | null
          )?.[dimension]
      )
      .filter((value): value is number => value !== undefined);

    return values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  };

  const dedupedPatterns = (
    await filterPatternsWithUsableScores(
      dedupeFailurePatterns((patternsRes.data || []) as FailurePattern[]),
      loadUsableScoreMap
    )
  ).slice(0, 5);

  return {
    week_start: sevenDaysAgo.toISOString().slice(0, 10),
    week_end: new Date().toISOString().slice(0, 10),
    summary: {
      total_conversations: thisWeek.length,
      total_scored: scored.length,
      avg_overall_score: avgScore,
      avg_accuracy: averageFor("accuracy_score"),
      avg_hallucination: averageFor("hallucination_score"),
      avg_resolution: averageFor("resolution_score"),
      score_trend: avgScore - lastWeekAvg,
      hallucination_count: hallucinationCount,
      escalation_count: escalationCount,
      top_failures: worstConversations,
      prompt_improvements: promptImprovements,
      knowledge_gaps: knowledgeGaps,
    },
    alerts: (alertsRes.data || []) as Alert[],
    patterns: dedupedPatterns,
    organization_recommendations: buildOrgRecommendations(
      scored.map((conversation) => ({
        id: conversation.id as string,
        quality_score: getJoinedRecord(
          conversation.quality_scores as
            | QualityScore
            | QualityScore[]
            | null
        ) as QualityScore,
      })),
      dedupedPatterns
    ),
    trend_data: Object.entries(trendByDay)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, values]) => ({
        date,
        overall:
          values.overall.reduce((sum, value) => sum + value, 0) / values.overall.length,
        accuracy:
          values.accuracy.length > 0
            ? values.accuracy.reduce((sum, value) => sum + value, 0) /
              values.accuracy.length
            : undefined,
        hallucination:
          values.hallucination.length > 0
            ? values.hallucination.reduce((sum, value) => sum + value, 0) /
              values.hallucination.length
            : undefined,
      })),
  };
}

export async function loadBenchmarkStats(
  workspaceId: string,
  days = 30
): Promise<BenchmarkStats> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from("ag_conversations")
    .select("quality_scores:ag_quality_scores(overall_score, flags, claim_analysis, confidence_level, structural_metrics, scoring_model_version), metadata")
    .eq("workspace_id", workspaceId)
    .gte("created_at", since.toISOString())
    .not("quality_scores", "is", null);

  if (error) {
    throw new Error(`Failed to fetch benchmark stats: ${error.message}`);
  }

  const scores = (data || [])
    .filter((conversation) => !isManualCalibrationConversation((conversation.metadata as Record<string, unknown> | null) || null))
    .map((conversation) =>
      getJoinedRecord(
        conversation.quality_scores as
          | {
              overall_score?: number;
              flags?: string[] | null;
              claim_analysis?: QualityScore["claim_analysis"];
              confidence_level?: "high" | "medium" | "low";
              scoring_model_version?: string | null;
              structural_metrics?: { confidence_level?: "high" | "medium" | "low" };
            }
          | {
              overall_score?: number;
              flags?: string[] | null;
              claim_analysis?: QualityScore["claim_analysis"];
              confidence_level?: "high" | "medium" | "low";
              scoring_model_version?: string | null;
              structural_metrics?: { confidence_level?: "high" | "medium" | "low" };
            }[]
          | null
      )
    )
    .filter((score): score is NonNullable<typeof score> => isAggregateEligibleScore(score))
    .map((score) => score.overall_score)
    .filter((score): score is number => score !== undefined);

  return {
    avg_score:
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : null,
    total_scored: scores.length,
  };
}
