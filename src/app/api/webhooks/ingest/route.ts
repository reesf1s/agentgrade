import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { scoreConversation } from "@/lib/scoring";

const VALID_ROLES = ["agent", "customer", "human_agent", "system"] as const;

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
      .from("ag_agent_connections")
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

    const wasEscalated = messages.some((m) => m.role === "human_agent");
    const timestamps = messages
      .filter((m) => m.timestamp)
      .map((m) => new Date(m.timestamp!).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b);

    // Insert conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("ag_conversations")
      .insert({
        workspace_id: connection.workspace_id,
        agent_connection_id: connection.id,
        external_id: body.conversation_id || null,
        platform: body.platform || connection.platform || "custom",
        customer_identifier: body.customer_identifier || null,
        message_count: messages.length,
        was_escalated: wasEscalated,
        started_at: timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null,
        ended_at: timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : null,
        metadata: body.metadata || {},
      })
      .select("id")
      .single();

    if (convError || !conversation) {
      console.error("Failed to insert conversation:", convError);
      return NextResponse.json({ error: "Failed to store conversation" }, { status: 500 });
    }

    // Insert messages
    const messageRows = messages.map((msg) => ({
      conversation_id: conversation.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
      metadata: {},
    }));

    const { error: msgError } = await supabaseAdmin.from("ag_messages").insert(messageRows);

    if (msgError) {
      console.error("Failed to insert messages:", msgError);
      // Don't fail the request - conversation was stored
    }

    after(async () => {
      try {
        await scoreConversation(conversation.id);
      } catch (scoreError) {
        console.error(`Scoring failed for conversation ${conversation.id}:`, scoreError);
      }
    });

    return NextResponse.json({
      success: true,
      conversation_id: conversation.id,
      message: `Conversation ingested with ${messages.length} messages. Scoring in progress.`,
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
        messages: "Array of { role: 'agent'|'customer'|'human_agent'|'system', content: string, timestamp?: string }",
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
