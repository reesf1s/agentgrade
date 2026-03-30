import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

function isMissingTableError(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST205";
}

/**
 * GET /api/fixes/:id/verify
 * Checks quality before/after a fix was pushed by comparing score averages.
 * Compares conversations from before the fix was pushed vs after.
 *
 * Returns: { before, after, improvement, source_conversations }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: fix, error: fetchError } = await supabaseAdmin
      .from("ag_suggested_fixes")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (fetchError || !fix) {
      if (isMissingTableError(fetchError)) {
        return NextResponse.json(
          { error: "Suggested fixes storage is not configured yet in this environment" },
          { status: 501 }
        );
      }
      return NextResponse.json({ error: "Fix not found" }, { status: 404 });
    }

    if (fix.status === "pending") {
      return NextResponse.json({
        message: "Fix has not been pushed yet. Approve and push it to compare before/after quality.",
        fix_status: fix.status,
      });
    }

    // Source conversations = conversations that surfaced this issue
    const sourceConvIds = (fix.source_conversation_ids || []) as string[];
    const pushedAt = fix.pushed_at ? new Date(fix.pushed_at) : new Date(fix.updated_at);

    // Get scores for source conversations (before fix)
    const { data: sourceScores } = await supabaseAdmin
      .from("ag_quality_scores")
      .select("overall_score, accuracy_score, hallucination_score, resolution_score, scored_at")
      .in("conversation_id", sourceConvIds.slice(0, 50)); // limit for performance

    // Get scores for conversations created after the fix was pushed
    const { data: afterScores } = await supabaseAdmin
      .from("ag_conversations")
      .select("quality_scores:ag_quality_scores(overall_score, accuracy_score, hallucination_score, resolution_score)")
      .eq("workspace_id", ctx.workspace.id)
      .gte("created_at", pushedAt.toISOString())
      .not("quality_scores", "is", null)
      .limit(50);

    const avg = (arr: (number | null | undefined)[]) => {
      const nums = arr.filter((n): n is number => n !== null && n !== undefined);
      return nums.length > 0 ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
    };

    const beforeScores = sourceScores || [];
    const afterScoredConvs = afterScores || [];

    const beforeStats = {
      count: beforeScores.length,
      avg_overall: avg(beforeScores.map((s) => s.overall_score)),
      avg_accuracy: avg(beforeScores.map((s) => s.accuracy_score)),
      avg_hallucination: avg(beforeScores.map((s) => s.hallucination_score)),
    };

    const afterQs = afterScoredConvs.map(
      (c) => c.quality_scores as { overall_score?: number; accuracy_score?: number; hallucination_score?: number } | null
    );

    const afterStats = {
      count: afterScoredConvs.length,
      avg_overall: avg(afterQs.map((q) => q?.overall_score)),
      avg_accuracy: avg(afterQs.map((q) => q?.accuracy_score)),
      avg_hallucination: avg(afterQs.map((q) => q?.hallucination_score)),
    };

    const improvement = beforeStats.avg_overall !== null && afterStats.avg_overall !== null
      ? afterStats.avg_overall - beforeStats.avg_overall
      : null;

    return NextResponse.json({
      fix: {
        id: fix.id,
        title: fix.title,
        fix_type: fix.fix_type,
        status: fix.status,
        pushed_at: fix.pushed_at,
      },
      before: beforeStats,
      after: afterStats,
      improvement,
      verdict:
        improvement === null
          ? "insufficient_data"
          : improvement > 0.05
          ? "improved"
          : improvement < -0.05
          ? "degraded"
          : "no_change",
      note:
        afterScoredConvs.length < 10
          ? "Fewer than 10 conversations scored after fix was pushed. Results may not be statistically significant."
          : null,
    });
  } catch (error) {
    console.error("Fix verify error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["owner", "admin"].includes(ctx.member.role)) {
      return NextResponse.json({ error: "Only owners and admins can verify fixes" }, { status: 403 });
    }

    const { id } = await params;

    const { data: updated, error } = await supabaseAdmin
      .from("ag_suggested_fixes")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        verified_by: ctx.member.clerk_user_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .select("*")
      .single();

    if (error || !updated) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { error: "Suggested fixes storage is not configured yet in this environment" },
          { status: 501 }
        );
      }
      return NextResponse.json({ error: "Failed to verify fix" }, { status: 500 });
    }

    return NextResponse.json({ success: true, fix: updated });
  } catch (error) {
    console.error("Fix verify POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
