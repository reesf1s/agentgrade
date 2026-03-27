import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/conversations
 * Returns paginated conversations with quality scores.
 * Query params: ?search=&score_filter=all|critical|warning|good&page=1&limit=50
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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("ag_conversations")
      .select("*, quality_scores(*)", { count: "exact" })
      .eq("workspace_id", ctx.workspace.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `customer_identifier.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("Conversations query error:", error);
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }

    // Apply score filter in memory (needs joining quality_scores)
    let conversations = data || [];
    if (scoreFilter !== "all") {
      conversations = conversations.filter((c) => {
        const qs = c.quality_scores as { overall_score?: number } | null;
        const score = qs?.overall_score ?? null;
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
