import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/dashboard
 * Returns dashboard stats, quality trend (30 days), recent conversations, and active alerts.
 *
 * Response shape:
 * {
 *   stats: { avg_score, conversations_scored, hallucination_rate, escalation_rate },
 *   conversations: Conversation[],      // last 20 (with quality_score)
 *   alerts: Alert[],                    // top 5 unacknowledged
 *   trend_data: { date, overall }[],    // daily avg scores for last 30 days
 *   top_patterns: FailurePattern[],     // top 3 unresolved patterns
 * }
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = ctx.workspace.id;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [conversationsRes, alertsRes, trendRes, patternsRes] = await Promise.all([
      // Recent conversations (last 20 in 30-day window)
      supabaseAdmin
        .from("ag_conversations")
        .select("*, ag_quality_scores(*)")
        .eq("workspace_id", workspaceId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(20),

      // Unacknowledged alerts (top 5 most recent)
      supabaseAdmin
        .from("ag_alerts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .is("acknowledged_at", null)
        .order("triggered_at", { ascending: false })
        .limit(5),

      // All scored conversations for trend (30 days, ascending for chart)
      supabaseAdmin
        .from("ag_conversations")
        .select("created_at, ag_quality_scores(overall_score, accuracy_score, hallucination_score, resolution_score)")
        .eq("workspace_id", workspaceId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true }),

      // Top unresolved failure patterns
      supabaseAdmin
        .from("ag_failure_patterns")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_resolved", false)
        .order("detected_at", { ascending: false })
        .limit(3),
    ]);

    const conversations = (conversationsRes.data || []).map((c) => ({
      ...c,
      quality_score: c.ag_quality_scores || null,
    }));

    const alerts = alertsRes.data || [];

    // Compute stats across all conversations with scores
    const scored = conversations.filter(
      (c) => c.quality_score && (c.quality_score as { overall_score?: number }).overall_score !== undefined
    );

    const avgScore =
      scored.length > 0
        ? scored.reduce((s, c) => s + ((c.quality_score as { overall_score: number }).overall_score || 0), 0) / scored.length
        : 0;

    // Hallucination rate: fraction of scored convos with hallucination_score < 0.5
    const hallucinationRate =
      scored.length > 0
        ? scored.filter((c) => {
            const qs = c.quality_score as { hallucination_score?: number };
            return qs.hallucination_score !== undefined && qs.hallucination_score < 0.5;
          }).length / scored.length
        : 0;

    const escalationRate =
      conversations.length > 0
        ? conversations.filter((c) => c.was_escalated).length / conversations.length
        : 0;

    // Build daily trend data
    const trendByDay: Record<string, number[]> = {};
    for (const conv of trendRes.data || []) {
      const day = conv.created_at.slice(0, 10);
      const qs = conv.ag_quality_scores as { overall_score?: number } | null;
      if (qs?.overall_score !== undefined) {
        if (!trendByDay[day]) trendByDay[day] = [];
        trendByDay[day].push(qs.overall_score);
      }
    }

    const trendData = Object.entries(trendByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, scores]) => ({
        date,
        overall: scores.reduce((s, v) => s + v, 0) / scores.length,
      }));

    return NextResponse.json({
      stats: {
        avg_score: avgScore,
        conversations_scored: scored.length,
        hallucination_rate: hallucinationRate,
        escalation_rate: escalationRate,
      },
      conversations,
      alerts,
      trend_data: trendData,
      top_patterns: patternsRes.data || [],
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
