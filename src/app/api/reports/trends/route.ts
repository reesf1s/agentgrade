import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/reports/trends
 * Returns quality score trends over a configurable time range.
 *
 * Query params:
 *   days      — number of days to look back (default: 30, max: 90)
 *   interval  — 'day' | 'week' (default: 'day')
 *   dimension — specific dimension to trend ('overall', 'accuracy', 'hallucination', etc.)
 *               defaults to returning all dimensions
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = ctx.workspace.id;
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get("days") || "30"), 90);
    const interval = searchParams.get("interval") || "day"; // 'day' | 'week'

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: convs, error } = await supabaseAdmin
      .from("ag_conversations")
      .select("created_at, ag_quality_scores(overall_score, accuracy_score, hallucination_score, resolution_score, tone_score, sentiment_score)")
      .eq("workspace_id", workspaceId)
      .gte("created_at", since.toISOString())
      .not("ag_quality_scores", "is", null)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch trend data" }, { status: 500 });
    }

    // Bucket by day or week
    const buckets: Record<string, {
      overall: number[];
      accuracy: number[];
      hallucination: number[];
      resolution: number[];
      tone: number[];
      sentiment: number[];
      count: number;
    }> = {};

    for (const conv of convs || []) {
      const date = new Date(conv.created_at);
      let key: string;

      if (interval === "week") {
        // Round down to Monday
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(date);
        monday.setDate(diff);
        key = monday.toISOString().slice(0, 10);
      } else {
        key = conv.created_at.slice(0, 10);
      }

      const qs = conv.ag_quality_scores as {
        overall_score?: number;
        accuracy_score?: number;
        hallucination_score?: number;
        resolution_score?: number;
        tone_score?: number;
        sentiment_score?: number;
      } | null;

      if (!qs?.overall_score) continue;

      if (!buckets[key]) {
        buckets[key] = { overall: [], accuracy: [], hallucination: [], resolution: [], tone: [], sentiment: [], count: 0 };
      }

      const b = buckets[key];
      b.overall.push(qs.overall_score);
      if (qs.accuracy_score !== undefined) b.accuracy.push(qs.accuracy_score);
      if (qs.hallucination_score !== undefined) b.hallucination.push(qs.hallucination_score);
      if (qs.resolution_score !== undefined) b.resolution.push(qs.resolution_score);
      if (qs.tone_score !== undefined) b.tone.push(qs.tone_score);
      if (qs.sentiment_score !== undefined) b.sentiment.push(qs.sentiment_score);
      b.count++;
    }

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

    const trendData = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({
        date,
        count: b.count,
        overall: avg(b.overall),
        accuracy: avg(b.accuracy),
        hallucination: avg(b.hallucination),
        resolution: avg(b.resolution),
        tone: avg(b.tone),
        sentiment: avg(b.sentiment),
      }));

    // Compute overall stats for the period
    const allScores = Object.values(buckets).flatMap((b) => b.overall);
    const periodAvg = avg(allScores);

    // Compare with prior period
    const priorSince = new Date(since);
    priorSince.setDate(priorSince.getDate() - days);

    const { data: priorConvs } = await supabaseAdmin
      .from("ag_conversations")
      .select("ag_quality_scores(overall_score)")
      .eq("workspace_id", workspaceId)
      .gte("created_at", priorSince.toISOString())
      .lt("created_at", since.toISOString())
      .not("ag_quality_scores", "is", null);

    const priorScores = (priorConvs || [])
      .map((c) => (c.ag_quality_scores as { overall_score?: number } | null)?.overall_score)
      .filter((s): s is number => s !== undefined);
    const priorAvg = avg(priorScores);

    return NextResponse.json({
      period: { days, interval, from: since.toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) },
      stats: {
        avg_score: periodAvg,
        total_scored: allScores.length,
        change_vs_prior: periodAvg !== null && priorAvg !== null ? periodAvg - priorAvg : null,
      },
      trend_data: trendData,
    });
  } catch (error) {
    console.error("Trends error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
