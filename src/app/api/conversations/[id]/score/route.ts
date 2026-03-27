import { NextRequest, NextResponse } from "next/server";
import { runScoringPipeline } from "@/lib/scoring";
import type { Message } from "@/lib/db/types";

/**
 * Trigger scoring for a specific conversation.
 * POST /api/conversations/:id/score
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const messages: Message[] = body.messages;
    const knowledgeBaseContext: string[] = body.knowledge_base_context || [];

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    // Run the full scoring pipeline (1 API call)
    const score = await runScoringPipeline({
      messages,
      knowledgeBaseContext,
    });

    return NextResponse.json({
      conversation_id: id,
      ...score,
      scored_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scoring error:", error);
    return NextResponse.json(
      { error: "Scoring failed", details: String(error) },
      { status: 500 }
    );
  }
}
