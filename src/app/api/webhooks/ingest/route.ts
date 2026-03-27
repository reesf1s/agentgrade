import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { scoreConversation } from "@/lib/scoring";
import { upsertConversationWithMessages } from "@/lib/ingest/upsert-conversation";

const VALID_ROLES = ["agent", "customer", "human_agent", "system", "tool"] as const;

/**
 * Generic webhook endpoint for ingesting conversations from any platform.
 * Authenticate via: Authorization: Bearer <agent_connection.webhook_secret>
 *
 * Expected payload:
 * {
 *   "conversation_id": "ext-123",      // optional: your platform's ID
 *   "platform": "custom",              // optional, defaults to "custom"
 *   "customer_identifier": "user@example.com",  // optional
 *   "messages": [
 *     { "role": "customer", "content": "...", "timestamp": "2024-01-01T00:00:00Z" },
 *     { "role": "agent",    "content": "...", "timestamp": "2024-01-01T00:01:00Z" }
 *   ],
 *   "metadata": {}                     // optional
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate: look up workspace by webhook_secret
    const authHeader = request.headers.get("authorization") || "";
    const webhookSecret = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Authorization: Bearer <webhook_secret> header required" },
        { status: 401 }
      );
    }

    const { data: connections, error: connError } = await supabaseAdmin
      .from("agent_connections")
      .select("id, workspace_id, platform, is_active")
      .eq("webhook_secret", webhookSecret)
      .limit(1);

    const connection = connections?.[0] || null;

    if (connError || !connection) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }

    if (!connection.is_active) {
      return NextResponse.json({ error: "Agent connection is inactive" }, { status: 403 });
    }

    const body = await request.json();

    // Validate messages
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required and must not be empty" },
        { status: 400 }
      );
    }

    for (const msg of body.messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: "Each message must have 'role' and 'content' fields" },
          { status: 400 }
        );
      }
      if (!VALID_ROLES.includes(msg.role)) {
        return NextResponse.json(
          { error: `Invalid role: ${msg.role}. Must be one of: ${VALID_ROLES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const messages = body.messages as Array<{
      role: typeof VALID_ROLES[number];
      content: string;
      timestamp?: string;
    }>;

    const ingestionResult = await upsertConversationWithMessages(connection, {
      messages,
      externalId: body.conversation_id || null,
      platform: body.platform || connection.platform || "custom",
      customerIdentifier: body.customer_identifier || null,
      metadata: body.metadata || {},
    });

    after(async () => {
      try {
        await scoreConversation(ingestionResult.conversationId);
      } catch (scoreError) {
        console.error(`Scoring failed for conversation ${ingestionResult.conversationId}:`, scoreError);
      }
    });

    return NextResponse.json({
      success: true,
      conversation_id: ingestionResult.conversationId,
      inserted_messages: ingestionResult.insertedMessages,
      message: ingestionResult.created
        ? `Conversation ingested with ${messages.length} messages. Scoring in progress.`
        : ingestionResult.insertedMessages > 0
          ? `Conversation updated with ${ingestionResult.insertedMessages} new messages. Re-scoring in progress.`
          : "Conversation already up to date.",
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
    auth: "Authorization: Bearer <webhook_secret> (from Settings > Connections)",
    docs: {
      method: "POST",
      content_type: "application/json",
      required_fields: {
        messages: "Array of { role: 'agent'|'customer'|'human_agent'|'system'|'tool', content: string, timestamp?: string }",
      },
      optional_fields: {
        conversation_id: "Your platform's conversation ID",
        platform: "Platform name (defaults to 'custom')",
        customer_identifier: "Customer email or ID",
        metadata: "Additional metadata object",
      },
    },
  });
}
