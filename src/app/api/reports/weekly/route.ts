import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import type { PromptImprovement, KnowledgeGap, WeeklyReportSummary } from "@/lib/db/types";
import { isInsightEligibleScore } from "@/lib/scoring/quality-score-status";

/**
 * GET /api/reports/weekly
 * Returns weekly reports. If a pre-generated report exists for the current week,
 * returns it. Otherwise aggregates from conversations and caches the result.
 *
 * Query params:
 *   week_start — ISO date string (YYYY-MM-DD) to fetch a specific week
 *   limit      — number of historical weeks to return (default: 4)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = ctx.workspace.id;
    const { searchParams } = new URL(request.url);
    const weekStartParam = searchParams.get("week_start");
    const limit = Math.min(parseInt(searchParams.get("limit") || "4"), 12);

    // If a specific week is requested, return just that report
    if (weekStartParam) {
      const weekStart = new Date(weekStartParam);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      // Try cached first
      const { data: cached } = await supabaseAdmin
        .from("weekly_reports")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("week_start", weekStartParam)
        .single();

      if (cached) {
        return NextResponse.json({ report: cached });
      }

      // Generate and cache
      const report = await generateWeeklyReport(workspaceId, weekStart, weekEnd);
      return NextResponse.json({ report });
    }

    // Return the last N weeks of reports
    const { data: existingReports } = await supabaseAdmin
      .from("weekly_reports")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("week_start", { ascending: false })
      .limit(limit);

    // Generate current week if not cached
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const currentWeekStartStr = currentWeekStart.toISOString().slice(0, 10);

    const hasCurrentWeek = existingReports?.some((r) => r.week_start === currentWeekStartStr);

    if (!hasCurrentWeek) {
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
      const currentReport = await generateWeeklyReport(workspaceId, currentWeekStart, currentWeekEnd);

      return NextResponse.json({
        reports: [currentReport, ...(existingReports || [])].slice(0, limit),
      });
    }

    return NextResponse.json({ reports: existingReports || [] });
  } catch (error) {
    console.error("Weekly reports error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Helper: get Monday of current week ──────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust for Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Weekly report generator ──────────────────────────────────────────────────

async function generateWeeklyReport(
  workspaceId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<{ id?: string; workspace_id: string; week_start: string; week_end: string; summary: WeeklyReportSummary; generated_at: string }> {
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // Also need prior week for trend comparison
  const priorWeekStart = new Date(weekStart);
  priorWeekStart.setDate(priorWeekStart.getDate() - 7);

  const [thisWeekRes, priorWeekRes] = await Promise.all([
    supabaseAdmin
      .from("conversations")
      .select("*, quality_scores:quality_scores(*)")
      .eq("workspace_id", workspaceId)
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", weekEnd.toISOString()),

    supabaseAdmin
      .from("conversations")
      .select("quality_scores:quality_scores(overall_score, flags, confidence_level, structural_metrics, scoring_model_version)")
      .eq("workspace_id", workspaceId)
      .gte("created_at", priorWeekStart.toISOString())
      .lt("created_at", weekStart.toISOString()),
  ]);

  const thisWeek = thisWeekRes.data || [];
  const scored = thisWeek.filter((c) =>
    isInsightEligibleScore(
      c.quality_scores as {
        overall_score?: number;
        flags?: string[] | null;
        confidence_level?: "high" | "medium" | "low";
        scoring_model_version?: string | null;
        structural_metrics?: { confidence_level?: "high" | "medium" | "low" };
      } | null
    )
  );

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  const avgOverall = avg(scored.map((c) => (c.quality_scores as { overall_score: number }).overall_score));
  const avgAccuracy = avg(scored.map((c) => (c.quality_scores as { accuracy_score?: number }).accuracy_score ?? 0));
  const avgHallucination = avg(scored.map((c) => (c.quality_scores as { hallucination_score?: number }).hallucination_score ?? 0));
  const avgResolution = avg(scored.map((c) => (c.quality_scores as { resolution_score?: number }).resolution_score ?? 0));

  const priorScored = (priorWeekRes.data || []).filter((c) =>
    isInsightEligibleScore(
      c.quality_scores as unknown as {
        overall_score?: number;
        flags?: string[] | null;
        confidence_level?: "high" | "medium" | "low";
        scoring_model_version?: string | null;
        structural_metrics?: { confidence_level?: "high" | "medium" | "low" };
      } | null
    )
  );
  const priorAvg = avg(priorScored.map((c) => (c.quality_scores as unknown as { overall_score: number }).overall_score));

  const hallucinationCount = scored.filter((c) => {
    const qs = c.quality_scores as { hallucination_score?: number };
    return qs.hallucination_score !== undefined && qs.hallucination_score < 0.5;
  }).length;

  const escalationCount = thisWeek.filter((c) => c.was_escalated).length;

  // Aggregate improvements and gaps
  const improvementMap = new Map<string, { imp: PromptImprovement; count: number }>();
  const gapMap = new Map<string, KnowledgeGap & { count: number }>();

  for (const conv of scored) {
    const qs = conv.quality_scores as { prompt_improvements?: PromptImprovement[]; knowledge_gaps?: KnowledgeGap[] } | null;
    for (const imp of qs?.prompt_improvements || []) {
      const key = imp.issue.toLowerCase();
      if (improvementMap.has(key)) improvementMap.get(key)!.count++;
      else improvementMap.set(key, { imp, count: 1 });
    }
    for (const gap of qs?.knowledge_gaps || []) {
      const key = gap.topic.toLowerCase();
      if (gapMap.has(key)) gapMap.get(key)!.count++;
      else gapMap.set(key, { ...gap, count: 1 });
    }
  }

  const summary: WeeklyReportSummary = {
    total_conversations: thisWeek.length,
    total_scored: scored.length,
    avg_overall_score: avgOverall,
    avg_accuracy: avgAccuracy,
    avg_hallucination: avgHallucination,
    avg_resolution: avgResolution,
    score_trend: avgOverall - priorAvg,
    hallucination_count: hallucinationCount,
    escalation_count: escalationCount,
    top_failures: scored
      .sort((a, b) => {
        const aS = (a.quality_scores as { overall_score: number }).overall_score;
        const bS = (b.quality_scores as { overall_score: number }).overall_score;
        return aS - bS;
      })
      .slice(0, 5)
      .map((c) => ({
        conversation_id: c.id,
        score: (c.quality_scores as { overall_score: number }).overall_score,
        summary: (c.quality_scores as { summary?: string }).summary || "No summary available",
      })),
    prompt_improvements: [...improvementMap.values()].sort((a, b) => b.count - a.count).slice(0, 5).map(({ imp }) => imp),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    knowledge_gaps: [...gapMap.values()].sort((a, b) => b.count - a.count).slice(0, 5).map(({ count: _c, ...gap }) => gap),
  };

  // Cache in weekly_reports (upsert)
  const { data: saved } = await supabaseAdmin
    .from("weekly_reports")
    .upsert(
      {
        workspace_id: workspaceId,
        week_start: weekStartStr,
        week_end: weekEndStr,
        summary,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,week_start" }
    )
    .select("*")
    .single();

  return saved || {
    workspace_id: workspaceId,
    week_start: weekStartStr,
    week_end: weekEndStr,
    summary,
    generated_at: new Date().toISOString(),
  };
}
