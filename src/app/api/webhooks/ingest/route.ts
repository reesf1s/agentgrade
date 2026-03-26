import { NextRequest, NextResponse } from "next/server";

/**
 * Generic webhook endpoint for ingesting conversations from any platform.
 *
 * Expected payload:
 * {
 *   "conversation_id": "ext-123",
 *   "platform": "custom",
 *   "customer_identifier": "user@example.com",
 *   "messages": [
 *     { "role": "customer", "content": "...", "timestamp": "2024-01-01T00:00:00Z" },
 *     { "role": "agent", "content": "...", "timestamp": "2024-01-01T00:01:00Z" }
 *   ],
 *   "metadata": {}
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate message format
    for (const msg of body.messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: "Each message must have 'role' and 'content' fields" },
          { status: 400 }
        );
      }
      if (!["agent", "customer", "human_agent", "system"].includes(msg.role)) {
        return NextResponse.json(
          { error: `Invalid role: ${msg.role}. Must be agent, customer, human_agent, or system` },
          { status: 400 }
        );
      }
    }

    // In production: store conversation in Supabase, trigger scoring pipeline
    // For now, return success with conversation ID
    const conversationId = crypto.randomUUID();

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      message: `Conversation ingested with ${body.messages.length} messages. Scoring will begin shortly.`,
    });
  } catch (error) {
    console.error("Ingest webhook error:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: "AgentGrade Conversation Ingestion Webhook",
    version: "1.0",
    docs: {
      method: "POST",
      content_type: "application/json",
      required_fields: {
        messages: "Array of { role: 'agent'|'customer'|'human_agent', content: string, timestamp?: string }",
      },
      optional_fields: {
        conversation_id: "Your platform's conversation ID",
        platform: "Platform name (e.g., 'intercom', 'custom')",
        customer_identifier: "Customer email or ID",
        metadata: "Additional metadata object",
      },
    },
  });
}
