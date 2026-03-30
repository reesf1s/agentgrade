import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { scoreConversation } from "@/lib/scoring";

/**
 * POST /api/ingest/csv
 * Bulk ingest conversations from a CSV or JSON file upload.
 *
 * Auth: X-AgentGrade-API-Key: <webhook_secret>
 * Content-Type: multipart/form-data
 *
 * Form fields:
 *   file     — the CSV or JSON file
 *   platform — platform name (optional, defaults to 'csv')
 *
 * CSV format (required columns):
 *   conversation_id, role, content, timestamp (optional), customer_identifier (optional)
 *
 * JSON format:
 *   Array of conversation objects:
 *   [{ conversation_id, customer_identifier?, platform?, messages: [{role, content, timestamp?}] }]
 *
 * Returns: { success, conversations_ingested, errors[] }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const apiKey =
      request.headers.get("x-agentgrade-api-key") ||
      (() => {
        const auth = request.headers.get("authorization") || "";
        return auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
      })();

    if (!apiKey) {
      return NextResponse.json({ error: "X-AgentGrade-API-Key header required" }, { status: 401 });
    }

    const { data: connections } = await supabaseAdmin
      .from("ag_agent_connections")
      .select("id, workspace_id, is_active")
      .eq("webhook_secret", apiKey)
      .limit(1);

    const connection = connections?.[0] || null;
    if (!connection) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    if (!connection.is_active) {
      return NextResponse.json({ error: "Connection is inactive" }, { status: 403 });
    }

    // Parse multipart form
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const platform = (formData.get("platform") as string) || "csv";

    if (!file) {
      return NextResponse.json({ error: "file field is required" }, { status: 400 });
    }

    const fileText = await file.text();
    const fileName = file.name.toLowerCase();

    // Parse file into conversation groups
    let conversations: Array<{
      conversation_id?: string;
      customer_identifier?: string;
      platform?: string;
      messages: Array<{ role: string; content: string; timestamp?: string }>;
    }>;

    if (fileName.endsWith(".json")) {
      try {
        conversations = JSON.parse(fileText);
        if (!Array.isArray(conversations)) {
          return NextResponse.json({ error: "JSON file must be an array of conversation objects" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
      }
    } else {
      // Parse CSV — group rows by conversation_id
      conversations = parseCsvToConversations(fileText, platform);
    }

    if (conversations.length === 0) {
      return NextResponse.json({ error: "No conversations found in file" }, { status: 400 });
    }

    // Ingest each conversation
    const results = {
      conversations_ingested: 0,
      errors: [] as string[],
    };
    const scheduledConversationIds: string[] = [];

    for (const conv of conversations) {
      if (!conv.messages || conv.messages.length === 0) {
        results.errors.push(`Conversation ${conv.conversation_id || "unknown"}: no messages`);
        continue;
      }

      try {
        // Idempotency check
        if (conv.conversation_id) {
          const { data: existing } = await supabaseAdmin
            .from("ag_conversations")
            .select("id")
            .eq("workspace_id", connection.workspace_id)
            .eq("external_id", conv.conversation_id)
            .single();
          if (existing) continue;
        }

        const wasEscalated = conv.messages.some((m) => m.role === "human_agent");
        const timestamps = conv.messages
          .filter((m) => m.timestamp)
          .map((m) => new Date(m.timestamp!).getTime())
          .filter((t) => !isNaN(t))
          .sort((a, b) => a - b);

        const { data: conversation, error: convError } = await supabaseAdmin
          .from("ag_conversations")
          .insert({
            workspace_id: connection.workspace_id,
            agent_connection_id: connection.id,
            external_id: conv.conversation_id || null,
            platform: conv.platform || platform,
            customer_identifier: conv.customer_identifier || null,
            message_count: conv.messages.length,
            was_escalated: wasEscalated,
            started_at: timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null,
            ended_at: timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : null,
            metadata: {},
          })
          .select("id")
          .single();

        if (convError || !conversation) {
          results.errors.push(`Conversation ${conv.conversation_id || "unknown"}: insert failed`);
          continue;
        }

        await supabaseAdmin.from("ag_messages").insert(
          conv.messages.map((msg) => ({
            conversation_id: conversation.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
            metadata: {},
          }))
        );

        results.conversations_ingested++;
        scheduledConversationIds.push(conversation.id);

      } catch (err) {
        results.errors.push(`Conversation ${conv.conversation_id || "unknown"}: ${String(err)}`);
      }
    }

    after(async () => {
      for (const conversationId of scheduledConversationIds) {
        try {
          await scoreConversation(conversationId);
        } catch (scoreError) {
          console.error(`CSV scoring failed for ${conversationId}:`, scoreError);
        }
      }
    });

    return NextResponse.json({
      success: true,
      ...results,
      conversations_scheduled_for_scoring: scheduledConversationIds.length,
      message: `Ingested ${results.conversations_ingested} of ${conversations.length} conversations. Scoring scheduled.`,
    });
  } catch (error) {
    console.error("CSV ingest error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCsvToConversations(
  csvText: string,
  defaultPlatform: string
): Array<{
  conversation_id?: string;
  customer_identifier?: string;
  platform?: string;
  messages: Array<{ role: string; content: string; timestamp?: string }>;
}> {
  const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
  const colIndex = (name: string) => headers.indexOf(name);

  const idCol = colIndex("conversation_id");
  const roleCol = colIndex("role");
  const contentCol = colIndex("content");
  const timestampCol = colIndex("timestamp");
  const customerCol = colIndex("customer_identifier");
  const platformCol = colIndex("platform");

  if (roleCol === -1 || contentCol === -1) {
    throw new Error("CSV must have 'role' and 'content' columns");
  }

  // Group rows by conversation_id
  const convMap = new Map<string, {
    customer_identifier?: string;
    platform?: string;
    messages: Array<{ role: string; content: string; timestamp?: string }>;
  }>();

  let autoId = 1;

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i]);
    const convId = idCol >= 0 ? (cells[idCol] || `auto-${autoId++}`) : `auto-${autoId++}`;
    const role = cells[roleCol]?.toLowerCase() || "agent";
    const content = cells[contentCol] || "";
    const timestamp = timestampCol >= 0 ? cells[timestampCol] : undefined;
    const customer = customerCol >= 0 ? cells[customerCol] : undefined;
    const platform = platformCol >= 0 ? cells[platformCol] : undefined;

    if (!convMap.has(convId)) {
      convMap.set(convId, { customer_identifier: customer, platform, messages: [] });
    }

    const conv = convMap.get(convId)!;
    if (content) {
      conv.messages.push({ role, content, timestamp: timestamp || undefined });
    }
    if (customer) conv.customer_identifier = customer;
    if (platform) conv.platform = platform;
  }

  return Array.from(convMap.entries()).map(([conversation_id, data]) => ({
    conversation_id,
    ...data,
    platform: data.platform || defaultPlatform,
  }));
}

function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}
