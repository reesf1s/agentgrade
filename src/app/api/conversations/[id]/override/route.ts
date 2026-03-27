import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/conversations/:id/override
 * Submit a human quality override for a specific dimension.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const body = await request.json();

    if (!body.dimension || body.override_score === undefined) {
      return NextResponse.json(
        { error: "dimension and override_score are required" },
        { status: 400 }
      );
    }

    // Verify conversation belongs to this workspace
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("ag_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Get the quality score
    const { data: qualityScore, error: qsError } = await supabaseAdmin
      .from("ag_quality_scores")
      .select("id, overall_score, accuracy_score, hallucination_score, resolution_score, tone_score, sentiment_score")
      .eq("conversation_id", conversationId)
      .single();

    if (qsError || !qualityScore) {
      return NextResponse.json({ error: "No quality score found for this conversation" }, { status: 404 });
    }

    const dimensionScoreMap: Record<string, number | undefined> = {
      overall: qualityScore.overall_score,
      accuracy: qualityScore.accuracy_score ?? undefined,
      hallucination: qualityScore.hallucination_score ?? undefined,
      resolution: qualityScore.resolution_score ?? undefined,
      tone: qualityScore.tone_score ?? undefined,
      sentiment: qualityScore.sentiment_score ?? undefined,
    };

    const originalScore = dimensionScoreMap[body.dimension];
    if (originalScore === undefined) {
      return NextResponse.json(
        { error: `Dimension '${body.dimension}' not found or not scored` },
        { status: 400 }
      );
    }

    const { error: overrideError } = await supabaseAdmin
      .from("ag_quality_overrides")
      .insert({
        quality_score_id: qualityScore.id,
        dimension: body.dimension,
        original_score: body.original_score ?? originalScore,
        override_score: body.override_score,
        reason: body.reason || null,
        overridden_by: ctx.member.clerk_user_id,
      });

    if (overrideError) {
      console.error("Failed to store override:", overrideError);
      return NextResponse.json({ error: "Failed to record override" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      dimension: body.dimension,
      original_score: originalScore,
      override_score: body.override_score,
      message: "Override recorded. This will calibrate future scoring.",
    });
  } catch (error) {
    console.error("Override error:", error);
    return NextResponse.json({ error: "Failed to record override" }, { status: 500 });
  }
}
