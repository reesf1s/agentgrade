import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import type { PromptImprovement, KnowledgeGap } from "@/lib/db/types";

/**
 * GET /api/reports
 * Returns the current week's aggregated report data.
 * For historical reports see GET /api/reports/weekly.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = ctx.workspace.id;
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 14);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const [thisWeekRes, lastWeekRes, trendRes] = await Promise.all([
      supabaseAdmin
        .from("ag_conversations")
        .select("*, ag_quality_scores(*)")
        .eq("workspace_id", workspaceId)
        .gte("created_at", sevenDaysAgo.toISOString()),

      supabaseAdmin
        .from("ag_conversations")
        .select("ag_quality_scores(overall_score)")
        .eq("workspace_id", workspaceId)
        .gte("created_at", fourteenDaysAgo.toISOString())
        .lt("created_at", sevenDaysAgo.toISOString()),

      supabaseAdmin
        .from("ag_conversations")
        .select("created_at, ag_quality_scores(overall_score, accuracy_score, hallucination_score, resolution_score)")
        .eq("workspace_id", workspaceId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true }),
    ]);

    const thisWeek = thisWeekRes.data || [];
    const lastWeek = lastWeekRes.data || [];

    const scored = thisWeek.filter(
      (c) => c.ag_quality_scores && (c.ag_quality_scores as { overall_score?: number }).overall_score !== undefined
    );

    const avgScore =
      scored.length > 0
        ? scored.reduce((s, c) => s + ((c.ag_quality_scores as { overall_score: number }).overall_score || 0), 0) / scored.length
        : 0;

    const lastWeekScored = lastWeek.filter(
      (c) => c.ag_quality_scores && (c.ag_quality_scores as unknown as { overall_score?: number }).overall_score !== undefined
    );
    const lastWeekAvg =
      lastWeekScored.length > 0
        ? lastWeekScored.reduce((s, c) => s + ((c.ag_quality_scores as unknown as { overall_score: number }).overall_score || 0), 0) / lastWeekScored.length
        : 0;

    const avgAccuracy =
      scored.length > 0
        ? scored.reduce((s, c) => s + ((c.ag_quality_scores as { accuracy_score?: number }).accuracy_score || 0), 0) / scored.length
        : 0;

    const avgHallucination =
      scored.length > 0
        ? scored.reduce((s, c) => s + ((c.ag_quality_scores as { hallucination_score?: number }).hallucination_score || 0), 0) / scored.length
        : 0;

    const avgResolution =
      scored.length > 0
        ? scored.reduce((s, c) => s + ((c.ag_quality_scores as { resolution_score?: number }).resolution_score || 0), 0) / scored.length
        : 0;

    const hallucinationCount = scored.filter((c) => {
      const qs = c.ag_quality_scores as { hallucination_score?: number };
      return qs.hallucination_score !== undefined && qs.hallucination_score < 0.5;
    }).length;

    const escalationCount = thisWeek.filter((c) => c.was_escalated).length;

    // Aggregate prompt improvements and knowledge gaps across scored conversations
    const improvementMap = new Map<string, { imp: PromptImprovement; count: number }>();
    const gapMap = new Map<string, KnowledgeGap & { count: number }>();

    for (const conv of scored) {
      const qs = conv.ag_quality_scores as {
        prompt_improvements?: PromptImprovement[];
        knowledge_gaps?: KnowledgeGap[];
      } | null;
      for (const imp of qs?.prompt_improvements || []) {
        const key = imp.issue.toLowerCase();
        if (improvementMap.has(key)) { improvementMap.get(key)!.count++; }
        else { improvementMap.set(key, { imp, count: 1 }); }
      }
      for (const gap of qs?.knowledge_gaps || []) {
        const key = gap.topic.toLowerCase();
        if (gapMap.has(key)) { gapMap.get(key)!.count++; }
        else { gapMap.set(key, { ...gap, count: 1 }); }
      }
    }

    const promptImprovements = [...improvementMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ imp }) => imp);

    const knowledgeGaps = [...gapMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ count: _count, ...gap }) => gap);

    // Worst conversations this week
    const worstConversations = scored
      .sort((a, b) => {
        const aScore = (a.ag_quality_scores as { overall_score: number }).overall_score;
        const bScore = (b.ag_quality_scores as { overall_score: number }).overall_score;
        return aScore - bScore;
      })
      .slice(0, 5)
      .map((c) => ({
        conversation_id: c.id,
        score: (c.ag_quality_scores as { overall_score: number }).overall_score,
        summary: (c.ag_quality_scores as { summary?: string }).summary || "No summary available",
      }));

    // Build 30-day trend data
    const trendByDay: Record<string, { scores: number[]; acc: number[]; hall: number[] }> = {};
    for (const conv of trendRes.data || []) {
      const day = conv.created_at.slice(0, 10);
      const qs = conv.ag_quality_scores as {
        overall_score?: number;
        accuracy_score?: number;
        hallucination_score?: number;
      } | null;
      if (qs?.overall_score !== undefined) {
        if (!trendByDay[day]) trendByDay[day] = { scores: [], acc: [], hall: [] };
        trendByDay[day].scores.push(qs.overall_score);
        if (qs.accuracy_score !== undefined) trendByDay[day].acc.push(qs.accuracy_score);
        if (qs.hallucination_score !== undefined) trendByDay[day].hall.push(qs.hallucination_score);
      }
    }

    const trendData = Object.entries(trendByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { scores, acc, hall }]) => ({
        date,
        overall: scores.reduce((s, v) => s + v, 0) / scores.length,
        accuracy: acc.length > 0 ? acc.reduce((s, v) => s + v, 0) / acc.length : null,
        hallucination: hall.length > 0 ? hall.reduce((s, v) => s + v, 0) / hall.length : null,
      }));

    return NextResponse.json({
      week_start: sevenDaysAgo.toISOString().slice(0, 10),
      week_end: now.toISOString().slice(0, 10),
      summary: {
        total_conversations: thisWeek.length,
        total_scored: scored.length,
        avg_overall_score: avgScore,
        avg_accuracy: avgAccuracy,
        avg_hallucination: avgHallucination,
        avg_resolution: avgResolution,
        score_trend: avgScore - lastWeekAvg,
        hallucination_count: hallucinationCount,
        escalation_count: escalationCount,
        top_failures: worstConversations,
        prompt_improvements: promptImprovements,
        knowledge_gaps: knowledgeGaps,
      },
      trend_data: trendData,
    });
  } catch (error) {
    console.error("Reports API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
