/**
 * Weekly Report Generator
 *
 * Aggregates quality metrics for a workspace over a date range,
 * identifies the worst conversations and top failure patterns,
 * tracks improvement from applied fixes, and stores the report in DB.
 *
 * Usage:
 *   const report = await generateWeeklyReport(workspaceId, '2025-01-06', '2025-01-12');
 */

import { supabaseAdmin } from "@/lib/supabase";
import { aggregatePromptImprovements, aggregateKnowledgeGaps } from "@/lib/scoring/pattern-detector";
import type { WeeklyReport, WeeklyReportSummary, QualityScore, PromptImprovement, KnowledgeGap } from "@/lib/db/types";

// ─── Type Helpers ───────────────────────────────────────────────────
interface ConversationRow {
  id: string;
  created_at: string;
  was_escalated: boolean;
  quality_scores: QualityScore | null;
}

interface ScoreAverage {
  overall: number;
  accuracy: number;
  hallucination: number;
  resolution: number;
  tone: number;
  sentiment: number;
}

// ─── Metric Aggregation ─────────────────────────────────────────────
function computeAverages(scoredConvs: ConversationRow[]): ScoreAverage {
  const counts = { overall: 0, accuracy: 0, hallucination: 0, resolution: 0, tone: 0, sentiment: 0 };
  const sums = { overall: 0, accuracy: 0, hallucination: 0, resolution: 0, tone: 0, sentiment: 0 };

  for (const conv of scoredConvs) {
    const qs = conv.quality_scores;
    if (!qs) continue;

    sums.overall += qs.overall_score;
    counts.overall++;

    if (qs.accuracy_score !== undefined) { sums.accuracy += qs.accuracy_score; counts.accuracy++; }
    if (qs.hallucination_score !== undefined) { sums.hallucination += qs.hallucination_score; counts.hallucination++; }
    if (qs.resolution_score !== undefined) { sums.resolution += qs.resolution_score; counts.resolution++; }
    if (qs.tone_score !== undefined) { sums.tone += qs.tone_score; counts.tone++; }
    if (qs.sentiment_score !== undefined) { sums.sentiment += qs.sentiment_score; counts.sentiment++; }
  }

  return {
    overall: counts.overall > 0 ? sums.overall / counts.overall : 0,
    accuracy: counts.accuracy > 0 ? sums.accuracy / counts.accuracy : 0,
    hallucination: counts.hallucination > 0 ? sums.hallucination / counts.hallucination : 0,
    resolution: counts.resolution > 0 ? sums.resolution / counts.resolution : 0,
    tone: counts.tone > 0 ? sums.tone / counts.tone : 0,
    sentiment: counts.sentiment > 0 ? sums.sentiment / counts.sentiment : 0,
  };
}

// ─── Improvement Tracking ───────────────────────────────────────────
/**
 * Computes the quality delta for patterns that have been resolved.
 * quality_after is the average score of conversations after the fix was applied,
 * quality_before is the average from before (stored in the pattern record itself — approximated).
 */
async function computeFixImprovements(
  workspaceId: string,
  weekStart: string,
  weekEnd: string
): Promise<{ pattern_title: string; quality_before: number; quality_after: number; delta: number }[]> {
  // Fetch patterns resolved during this week
  const { data: resolvedPatterns } = await supabaseAdmin
    .from("ag_failure_patterns")
    .select("id, title, affected_conversation_ids, resolved_at")
    .eq("workspace_id", workspaceId)
    .eq("is_resolved", true)
    .gte("resolved_at", weekStart)
    .lte("resolved_at", weekEnd);

  if (!resolvedPatterns || resolvedPatterns.length === 0) return [];

  const improvements = [];

  for (const pattern of resolvedPatterns) {
    const affectedIds = pattern.affected_conversation_ids as string[] | null;
    if (!affectedIds || affectedIds.length === 0) continue;

    // Quality before: average score of the affected (pre-fix) conversations
    const { data: beforeScores } = await supabaseAdmin
      .from("ag_quality_scores")
      .select("overall_score")
      .in("conversation_id", affectedIds);

    if (!beforeScores || beforeScores.length === 0) continue;

    const qualityBefore =
      beforeScores.reduce((s: number, row: { overall_score: number }) => s + row.overall_score, 0) /
      beforeScores.length;

    // Quality after: average score of conversations since the pattern was resolved
    const { data: afterConvs } = await supabaseAdmin
      .from("ag_conversations")
      .select("quality_scores:ag_quality_scores(overall_score)")
      .eq("workspace_id", workspaceId)
      .gte("created_at", pattern.resolved_at)
      .not("ag_quality_scores", "is", null)
      .limit(20);

    const afterScores = (afterConvs || [])
      .map((c) => {
        const qs = c.quality_scores as unknown as { overall_score?: number } | null;
        return qs?.overall_score;
      })
      .filter((s): s is number => s !== undefined);

    if (afterScores.length === 0) continue;

    const qualityAfter = afterScores.reduce((a, b) => a + b, 0) / afterScores.length;

    improvements.push({
      pattern_title: pattern.title as string,
      quality_before: qualityBefore,
      quality_after: qualityAfter,
      delta: qualityAfter - qualityBefore,
    });
  }

  return improvements.sort((a, b) => b.delta - a.delta);
}

// ─── Main Generator ─────────────────────────────────────────────────
/**
 * Generates a weekly quality report for a workspace.
 *
 * @param workspaceId - The workspace to report on
 * @param weekStart   - ISO date string "YYYY-MM-DD" (inclusive)
 * @param weekEnd     - ISO date string "YYYY-MM-DD" (inclusive)
 * @returns           The stored WeeklyReport record
 */
export async function generateWeeklyReport(
  workspaceId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyReport> {
  // Extend weekEnd to end of day for inclusive range
  const weekEndInclusive = `${weekEnd}T23:59:59.999Z`;
  const weekStartISO = `${weekStart}T00:00:00.000Z`;

  // ── Fetch this week's conversations ───────────────────────────
  const { data: thisWeekRaw } = await supabaseAdmin
    .from("ag_conversations")
    .select("id, created_at, was_escalated, quality_scores:ag_quality_scores(*)")
    .eq("workspace_id", workspaceId)
    .gte("created_at", weekStartISO)
    .lte("created_at", weekEndInclusive)
    .order("created_at", { ascending: true });

  // ── Fetch last week's conversations for trend calculation ─────
  const lastWeekEnd = new Date(weekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekStart.getDate() - 6);

  const { data: lastWeekRaw } = await supabaseAdmin
    .from("ag_conversations")
    .select("quality_scores:ag_quality_scores(overall_score)")
    .eq("workspace_id", workspaceId)
    .gte("created_at", lastWeekStart.toISOString())
    .lte("created_at", lastWeekEnd.toISOString());

  const thisWeek = (thisWeekRaw || []) as unknown as ConversationRow[];
  const scored = thisWeek.filter((c) => c.quality_scores !== null);

  // ── Compute aggregated metrics ─────────────────────────────────
  const avgs = computeAverages(scored);

  // Score trend: delta vs prior week
  const lastWeekAvg =
    (lastWeekRaw || []).length > 0
      ? (lastWeekRaw || [])
          .map((c) => {
            const qs = c.quality_scores as unknown as { overall_score?: number } | null;
            return qs?.overall_score;
          })
          .filter((s): s is number => s !== undefined)
          .reduce((a, b) => a + b, 0) /
          Math.max(
            1,
            (lastWeekRaw || []).filter((c) => {
              const qs = c.quality_scores as unknown as { overall_score?: number } | null;
              return qs?.overall_score !== undefined;
            }).length
          )
      : 0;

  // ── Hallucination and escalation counts ───────────────────────
  const hallucinationCount = scored.filter(
    (c) => (c.quality_scores?.hallucination_score ?? 1) < 0.5
  ).length;

  const escalationCount = thisWeek.filter((c) => c.was_escalated).length;

  // ── Worst 5 conversations ──────────────────────────────────────
  const worstConversations = scored
    .filter((c) => c.quality_scores)
    .sort((a, b) => (a.quality_scores!.overall_score) - (b.quality_scores!.overall_score))
    .slice(0, 5)
    .map((c) => ({
      conversation_id: c.id,
      score: c.quality_scores!.overall_score,
      summary: c.quality_scores!.summary || "No summary available.",
    }));

  // ── Top failure patterns this week ────────────────────────────
  const { data: activePatterns } = await supabaseAdmin
    .from("ag_failure_patterns")
    .select("title, severity, description")
    .eq("workspace_id", workspaceId)
    .eq("is_resolved", false)
    .in("severity", ["high", "critical"])
    .order("detected_at", { ascending: false })
    .limit(3);

  // ── Aggregate prompt improvements and KB gaps ─────────────────
  // Shape conversations to match pattern-detector's expected format
  const forDetector = scored
    .filter((c) => c.quality_scores)
    .map((c) => ({
      id: c.id,
      created_at: c.created_at,
      platform: "unknown",
      quality_score: c.quality_scores!,
    }));

  const promptImprovements: PromptImprovement[] = aggregatePromptImprovements(forDetector).slice(0, 5);
  const knowledgeGaps: KnowledgeGap[] = aggregateKnowledgeGaps(forDetector).slice(0, 5);

  // ── Improvement tracking from resolved fixes ──────────────────
  const fixImprovements = await computeFixImprovements(workspaceId, weekStart, weekEnd);

  // ── Build report summary ──────────────────────────────────────
  const summary: WeeklyReportSummary = {
    total_conversations: thisWeek.length,
    total_scored: scored.length,
    avg_overall_score: avgs.overall,
    avg_accuracy: avgs.accuracy,
    avg_hallucination: avgs.hallucination,
    avg_resolution: avgs.resolution,
    score_trend: avgs.overall - lastWeekAvg,
    hallucination_count: hallucinationCount,
    escalation_count: escalationCount,
    top_failures: worstConversations,
    prompt_improvements: promptImprovements,
    knowledge_gaps: knowledgeGaps,
  };

  // ── Upsert report to DB ───────────────────────────────────────
  // One report per week per workspace — overwrite if regenerated
  const { data: existing } = await supabaseAdmin
    .from("ag_weekly_reports")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("week_start", weekStart)
    .maybeSingle();

  let reportId: string;

  if (existing?.id) {
    // Update existing report
    await supabaseAdmin
      .from("ag_weekly_reports")
      .update({
        summary,
        generated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    reportId = existing.id as string;
  } else {
    // Insert new report
    const { data: newReport, error } = await supabaseAdmin
      .from("ag_weekly_reports")
      .insert({
        workspace_id: workspaceId,
        week_start: weekStart,
        week_end: weekEnd,
        summary,
        generated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !newReport) {
      throw new Error(`Failed to store weekly report: ${error?.message}`);
    }

    reportId = newReport.id as string;
  }

  console.log(
    `[weekly-report] Generated for workspace ${workspaceId}: ` +
    `${thisWeek.length} conversations, ${scored.length} scored, ` +
    `avg ${(avgs.overall * 100).toFixed(0)}%, trend ${avgs.overall - lastWeekAvg > 0 ? "+" : ""}${((avgs.overall - lastWeekAvg) * 100).toFixed(0)}% ` +
    `| fix improvements: ${fixImprovements.length} patterns resolved`
  );

  return {
    id: reportId,
    workspace_id: workspaceId,
    week_start: weekStart,
    week_end: weekEnd,
    summary,
    generated_at: new Date().toISOString(),
  };
}

// ─── Convenience: generate report for the most recent full week ─────
/**
 * Generates a report for the 7-day period ending yesterday.
 * Call this from a cron job every Monday.
 */
export async function generateLastWeekReport(workspaceId: string): Promise<WeeklyReport> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const weekEnd = yesterday.toISOString().slice(0, 10);

  const weekStartDate = new Date(yesterday);
  weekStartDate.setDate(weekStartDate.getDate() - 6);
  const weekStart = weekStartDate.toISOString().slice(0, 10);

  return generateWeeklyReport(workspaceId, weekStart, weekEnd);
}
