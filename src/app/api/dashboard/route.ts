import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/dashboard
 * Returns dashboard stats, recent conversations, and active alerts.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = ctx.workspace.id;

    // Fetch recent conversations with quality scores (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [conversationsRes, alertsRes, trendRes] = await Promise.all([
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

      // Aggregate daily scores for the trend chart
      supabaseAdmin
        .from("ag_conversations")
        .select("created_at, quality_scores:ag_quality_scores(overall_score, accuracy_score, hallucination_score, resolution_score)")
        .eq("workspace_id", workspaceId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true }),
    ]);

    const conversations = conversationsRes.data || [];
    const alerts = alertsRes.data || [];

    // Compute stats
    const scored = conversations.filter(
      (c) => c.quality_scores && (c.quality_scores as { overall_score?: number }).overall_score !== undefined
    );

    const avgScore =
      scored.length > 0
        ? scored.reduce((s, c) => s + ((c.quality_scores as { overall_score: number }).overall_score || 0), 0) / scored.length
        : 0;

    const hallucinationRate =
      scored.length > 0
        ? scored.filter((c) => {
            const qs = c.quality_scores as { hallucination_score?: number };
            return qs.hallucination_score !== undefined && qs.hallucination_score < 0.5;
          }).length / scored.length
        : 0;

    const escalationRate =
      conversations.length > 0
        ? conversations.filter((c) => c.was_escalated).length / conversations.length
        : 0;

    // Build trend data from daily aggregates
    const trendByDay: Record<string, number[]> = {};
    for (const conv of trendRes.data || []) {
      const day = conv.created_at.slice(0, 10);
      const qs = conv.quality_scores as { overall_score?: number } | null;
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
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
