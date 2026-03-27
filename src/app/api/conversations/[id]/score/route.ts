import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { runScoringPipeline } from "@/lib/scoring";
import type { Message } from "@/lib/db/types";

/**
 * POST /api/conversations/:id/score
 * Triggers (or re-triggers) the scoring pipeline for a conversation.
 * Fetches messages from DB, runs Claude evaluation, upserts quality score.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;

    // Verify conversation belongs to this workspace
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("ag_conversations")
      .select("id, workspace_id")
      .eq("id", conversationId)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Fetch messages from DB
    const { data: messageRows, error: msgError } = await supabaseAdmin
      .from("ag_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("timestamp", { ascending: true });

    if (msgError || !messageRows || messageRows.length === 0) {
      return NextResponse.json({ error: "No messages found for this conversation" }, { status: 400 });
    }

    const messages = messageRows as Message[];

    // Fetch knowledge base context for this workspace
    const { data: kbChunks } = await supabaseAdmin
      .from("ag_knowledge_base_items")
      .select("content")
      .eq("workspace_id", ctx.workspace.id)
      .limit(5);

    const knowledgeBaseContext = kbChunks?.map((c) => c.content) || [];

    // Run the full scoring pipeline (1 Claude API call)
    const scoreResult = await runScoringPipeline({ messages, knowledgeBaseContext });

    // Upsert quality score (delete old + insert, since conversation_id is unique)
    await supabaseAdmin
      .from("ag_quality_scores")
      .delete()
      .eq("conversation_id", conversationId);

    const { data: savedScore, error: scoreError } = await supabaseAdmin
      .from("ag_quality_scores")
      .insert({
        conversation_id: conversationId,
        ...scoreResult,
        scored_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (scoreError || !savedScore) {
      console.error("Failed to store quality score:", scoreError);
      return NextResponse.json({ error: "Scoring succeeded but failed to save result" }, { status: 500 });
    }

    return NextResponse.json({
      conversation_id: conversationId,
      ...savedScore,
    });
  } catch (error) {
    console.error("Scoring error:", error);
    return NextResponse.json(
      { error: "Scoring failed", details: String(error) },
      { status: 500 }
    );
  }
}
