import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/conversations
 * Returns paginated conversations with quality scores.
 * Query params:
 *   search        — filter by customer_identifier (partial match)
 *   score_filter  — all | critical (<0.4) | warning (0.4–0.7) | good (≥0.7)
 *   platform      — filter by platform name
 *   escalated     — true | false
 *   from          — ISO date string (created_at ≥)
 *   to            — ISO date string (created_at ≤)
 *   page          — 1-based page number (default 1)
 *   limit         — page size (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const scoreFilter = searchParams.get("score_filter") || "all";
    const platform = searchParams.get("platform") || "";
    const escalated = searchParams.get("escalated");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("ag_conversations")
      .select("*, ag_quality_scores(*)", { count: "exact" })
      .eq("workspace_id", ctx.workspace.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike("customer_identifier", `%${search}%`);
    }
    if (platform) {
      query = query.eq("platform", platform);
    }
    if (escalated === "true") {
      query = query.eq("was_escalated", true);
    } else if (escalated === "false") {
      query = query.eq("was_escalated", false);
    }
    if (from) {
      query = query.gte("created_at", from);
    }
    if (to) {
      query = query.lte("created_at", to);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("Conversations query error:", error);
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }

    // Apply score filter in memory (quality_score is a joined row)
    let conversations = (data || []).map((c) => ({
      ...c,
      quality_score: c.ag_quality_scores || null,
    }));

    if (scoreFilter !== "all") {
      conversations = conversations.filter((c) => {
        const score = (c.quality_score as { overall_score?: number } | null)?.overall_score ?? null;
        if (score === null) return false;
        if (scoreFilter === "critical") return score < 0.4;
        if (scoreFilter === "warning") return score >= 0.4 && score < 0.7;
        if (scoreFilter === "good") return score >= 0.7;
        return true;
      });
    }

    return NextResponse.json({
      conversations,
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Conversations API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
