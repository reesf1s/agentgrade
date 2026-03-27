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
    const search        = searchParams.get("search") || "";
    const scoreFilter   = searchParams.get("score_filter") || "all";
    const platform      = searchParams.get("platform") || "all";
    const escalated     = searchParams.get("escalated") || "all";
    const dateFrom      = searchParams.get("from") || "";
    const dateTo        = searchParams.get("to") || "";
    const limit         = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    // Support both offset-based (new) and page-based (legacy) pagination
    const offsetParam   = searchParams.get("offset");
    const pageParam     = searchParams.get("page");
    const offset = offsetParam !== null
      ? parseInt(offsetParam)
      : (parseInt(pageParam || "1") - 1) * limit;

    let query = supabaseAdmin
      .from("conversations")
      .select("*, quality_scores(*)", { count: "exact" })
      .eq("workspace_id", ctx.workspace.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike("customer_identifier", `%${search}%`);
    }
    if (platform !== "all") {
      query = query.eq("platform", platform);
    }
    if (escalated === "yes") {
      query = query.eq("was_escalated", true);
    } else if (escalated === "no") {
      query = query.eq("was_escalated", false);
    }
    if (dateFrom) {
      query = query.gte("created_at", new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1); // include the full to-day
      query = query.lt("created_at", to.toISOString());
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
      limit,
      offset,
    });
  } catch (error) {
    console.error("Conversations API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
