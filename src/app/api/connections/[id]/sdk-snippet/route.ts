import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

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
      .from("ag_agent_connections")
      .select("id, webhook_url, webhook_secret, name")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (error || !connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentgrade.com";
    const webhookUrl = `${appUrl}/api/webhooks/ingest`;

    // Generate a JavaScript SDK snippet
    const snippet = `// AgentGrade SDK — auto-log conversations
// Connection: ${connection.name}
// Install: npm install agentgrade  (or paste this inline)

const AgentGrade = {
  webhookUrl: "${webhookUrl}",
  apiKey: "${connection.webhook_secret}",

  async log(conversation) {
    await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + this.apiKey
      },
      body: JSON.stringify({
        messages: conversation.messages.map(msg => ({
          role: msg.role,            // "agent" | "customer"
          content: msg.content,
          timestamp: msg.timestamp ?? new Date().toISOString()
        })),
        customer_identifier: conversation.customerId,
        platform: "custom",
        was_escalated: conversation.wasEscalated ?? false
      })
    });
  }
};

// Usage example:
await AgentGrade.log({
  customerId: "user@example.com",
  wasEscalated: false,
  messages: [
    { role: "customer", content: "How do I reset my password?" },
    { role: "agent",    content: "Click 'Forgot password' on the login page." }
  ]
});`;

    return NextResponse.json({ snippet, webhook_url: webhookUrl, api_key: connection.webhook_secret });
  } catch (err) {
    console.error("sdk-snippet GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
