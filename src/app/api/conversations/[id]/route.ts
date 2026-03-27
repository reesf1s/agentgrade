import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/conversations/:id
 * Returns a single conversation with messages and quality score.
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

    const [convRes, messagesRes, scoreRes] = await Promise.all([
      supabaseAdmin
        .from("conversations")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", ctx.workspace.id)
        .single(),

      supabaseAdmin
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("timestamp", { ascending: true }),

      supabaseAdmin
        .from("quality_scores")
        .select("*")
        .eq("conversation_id", id)
        .single(),
    ]);

    if (convRes.error || !convRes.data) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const qualityScore = scoreRes.data
      ? {
          ...scoreRes.data,
          confidence_level:
            scoreRes.data.confidence_level ||
            scoreRes.data.structural_metrics?.confidence_level ||
            undefined,
        }
      : null;

    return NextResponse.json({
      ...convRes.data,
      messages: messagesRes.data || [],
      quality_score: qualityScore,
    });
  } catch (error) {
    console.error("Conversation detail API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
