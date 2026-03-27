import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUrl } from "@/lib/url";

function buildSnippet(input: {
  webhookUrl: string;
  secret: string;
  platform: string;
  connectionName: string;
}) {
  const baseExample = `fetch("${input.webhookUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${input.secret}"
  },
  body: JSON.stringify({
    conversation_id: "conv_123",
    platform: "${input.platform}",
    customer_identifier: "user@example.com",
    messages: [
      { role: "customer", content: "How do I reset my password?" },
      { role: "agent", content: "Use the Forgot password link on your login page." }
    ]
  })
});`;

  if (input.platform === "voiceflow") {
    return `// AgentGrade recipe for Voiceflow
// Connection: ${input.connectionName}
// Recommended trigger: call this from your Voiceflow custom action
// after each agent response, or when the conversation closes.

const transcript = [
  { role: "customer", content: lastUserMessage },
  { role: "agent", content: lastAssistantMessage }
];

${baseExample.replace(
  /conversation_id: "conv_123",\n    platform: "voiceflow",\n    customer_identifier: "user@example.com",\n    messages: \[\n      \{ role: "customer", content: "How do I reset my password\\?" \},\n      \{ role: "agent", content: "Use the Forgot password link on your login page\\." \}\n    \]/,
  `conversation_id: sessionId,
    platform: "voiceflow",
    customer_identifier: userId ?? "voiceflow-user",
    messages: transcript`
)}
`;
  }

  return `// AgentGrade SDK — auto-log conversations
// Connection: ${input.connectionName}
// Install: npm install agentgrade  (or paste this inline)

${baseExample}`;
}

/**
 * GET /api/connections/[id]/sdk-snippet
 * Returns a JavaScript SDK code snippet pre-configured for this connection.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getWorkspaceContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: connection, error } = await supabaseAdmin
      .from("agent_connections")
      .select("id, platform, webhook_url, webhook_secret, name")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (error || !connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const webhookUrl = `${resolveAppUrl(_request)}/api/webhooks/ingest`;

    const snippet = buildSnippet({
      webhookUrl,
      secret: connection.webhook_secret,
      platform: connection.platform || "custom",
      connectionName: connection.name,
    });

    return NextResponse.json({ snippet, webhook_url: webhookUrl, api_key: connection.webhook_secret });
  } catch (err) {
    console.error("sdk-snippet GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
