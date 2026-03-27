import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/conversations
 * Returns paginated conversations with quality scores.
 * Query params:
 *   ?search=
 *   &score_filter=all|critical|warning|good
 *   &platform=
 *   &escalated=true|false
 *   &flag=
 *   &date_from=ISO
 *   &date_to=ISO
 *   &page=1
 *   &limit=50
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
    const flag = searchParams.get("flag") || "";
    const dateFrom = searchParams.get("date_from") || "";
    const dateTo = searchParams.get("date_to") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("conversations")
      .select("*, quality_scores:quality_scores(*)", { count: "exact" })
      .eq("workspace_id", ctx.workspace.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `customer_identifier.ilike.%${search}%,external_id.ilike.%${search}%`
      );
    }
    if (platform) {
      query = query.eq("platform", platform);
    }
    if (escalated === "true") {
      query = query.eq("was_escalated", true);
    }
    if (escalated === "false") {
      query = query.eq("was_escalated", false);
    }
    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("created_at", dateTo);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("Conversations query error:", error);
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }

    // Apply score filter in memory (needs joining quality_scores)
    let conversations = data || [];
    if (scoreFilter !== "all" || flag) {
      conversations = conversations.filter((c) => {
        const qs = c.quality_scores as {
          overall_score?: number;
          flags?: string[];
        } | null;
        const score = qs?.overall_score ?? null;
        const matchesFlag = flag
          ? (qs?.flags || []).some((item) => item.toLowerCase().includes(flag.toLowerCase()))
          : true;
        if (!matchesFlag) return false;
        if (scoreFilter === "all") return true;
        if (score === null) return false;
        if (scoreFilter === "critical") return score < 0.4;
        if (scoreFilter === "warning") return score >= 0.4 && score < 0.7;
        if (scoreFilter === "good") return score >= 0.7;
        return true;
      });
    }

    conversations = conversations.map((conversation) => {
      const qualityScore = Array.isArray(conversation.quality_scores)
        ? conversation.quality_scores[0] || null
        : conversation.quality_scores;

      const normalizedQualityScore = qualityScore
        ? {
            ...qualityScore,
            confidence_level:
              qualityScore.confidence_level ||
              qualityScore.structural_metrics?.confidence_level ||
              undefined,
          }
        : null;

      return {
        ...conversation,
        quality_scores: normalizedQualityScore,
      };
    });

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
