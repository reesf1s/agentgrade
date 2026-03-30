import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { isConversationExplicitlyIncomplete } from "@/lib/ingest/completion";
import { isManualCalibrationConversation } from "@/lib/calibration";

function hasScoreError(qualityScore?: { flags?: string[] | null } | null) {
  return (qualityScore?.flags || []).includes("scoring_error");
}

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

    // When filtering by score, use an INNER join so we can filter at the DB level.
    // This ensures paginated results are correct regardless of conversation volume.
    const useInnerJoin = scoreFilter !== "all";
    const joinClause = useInnerJoin
      ? "quality_scores:quality_scores!inner(overall_score,accuracy_score,hallucination_score,resolution_score,flags,summary,confidence_level)"
      : "quality_scores:ag_quality_scores(overall_score,accuracy_score,hallucination_score,resolution_score,flags,summary,confidence_level)";

    let query = supabaseAdmin
      .from("ag_conversations")
      .select(`*, ${joinClause}`, { count: "exact" })
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

    // DB-level score filtering (works because of the inner join above)
    if (scoreFilter === "critical") {
      query = query.lt("quality_scores.overall_score", 0.4);
    } else if (scoreFilter === "warning") {
      query = query
        .gte("quality_scores.overall_score", 0.4)
        .lt("quality_scores.overall_score", 0.7);
    } else if (scoreFilter === "good") {
      query = query.gte("quality_scores.overall_score", 0.7);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("Conversations query error:", error);
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }

    // Flag filter is still applied in-memory (flag text search on a JSON array)
    let conversations = data || [];
    if (flag) {
      conversations = conversations.filter((c) => {
        const qs = c.quality_scores as { flags?: string[] } | null;
        return (qs?.flags || []).some((item) => item.toLowerCase().includes(flag.toLowerCase()));
      });
    }

    conversations = conversations
      .filter((conversation) => !isManualCalibrationConversation((conversation.metadata as Record<string, unknown> | null) || null))
      .map((conversation) => {
      const qualityScore = Array.isArray(conversation.quality_scores)
        ? conversation.quality_scores[0] || null
        : conversation.quality_scores;

      const metadata = (conversation.metadata as Record<string, unknown> | null) || null;
      const conversationIncomplete = isConversationExplicitlyIncomplete(metadata);
      const scoreFailed = hasScoreError(qualityScore);

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
        quality_scores: scoreFailed ? null : normalizedQualityScore,
        score_status: conversationIncomplete
          ? "waiting_for_completion"
          : scoreFailed
            ? "pending"
            : normalizedQualityScore
              ? "ready"
              : "pending",
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
