import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/connections/:id/sdk-snippet
 * Returns integration code snippets for the connection:
 * - JavaScript webhook SDK example
 * - Python REST API example
 * - cURL example
 * - Webhook URL and secret (for configuration)
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

    const { data: connection, error } = await supabaseAdmin
      .from("ag_agent_connections")
      .select("id, platform, name, webhook_url, webhook_secret")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (error || !connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const { webhook_url, webhook_secret, platform } = connection;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentgrade.com";
    const ingestUrl = webhook_url || `${appUrl}/api/webhooks/ingest`;
    const restUrl = `${appUrl}/api/ingest`;

    const jsSnippet = `// AgentGrade — send a conversation via webhook
// Install: npm install node-fetch (or use built-in fetch in Node 18+)

const AGENTGRADE_WEBHOOK_URL = "${ingestUrl}";
const AGENTGRADE_WEBHOOK_SECRET = "${webhook_secret}";

async function sendConversationToAgentGrade(conversation) {
  const response = await fetch(AGENTGRADE_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${AGENTGRADE_WEBHOOK_SECRET}\`,
    },
    body: JSON.stringify({
      conversation_id: conversation.id,        // your platform's ID
      customer_identifier: conversation.userEmail,
      platform: "${platform}",
      messages: conversation.messages.map(msg => ({
        role: msg.from === "bot" ? "agent" : "customer",
        content: msg.text,
        timestamp: msg.createdAt,
      })),
      metadata: { source: "${platform}" },
    }),
  });

  const result = await response.json();
  console.log("AgentGrade:", result.conversation_id);
  return result;
}`;

    const pythonSnippet = `# AgentGrade — Python REST API example
import requests

AGENTGRADE_URL = "${restUrl}"
AGENTGRADE_API_KEY = "ag_${webhook_secret?.slice(0, 16)}..."  # Get from Settings > API Keys

def send_conversation(messages, conversation_id=None, customer_email=None):
    response = requests.post(
        AGENTGRADE_URL,
        headers={
            "Content-Type": "application/json",
            "X-AgentGrade-API-Key": AGENTGRADE_API_KEY,
        },
        json={
            "conversation_id": conversation_id,
            "customer_identifier": customer_email,
            "platform": "${platform}",
            "messages": messages,
        },
    )
    response.raise_for_status()
    return response.json()

# Example usage
result = send_conversation(
    messages=[
        {"role": "customer", "content": "How do I reset my password?", "timestamp": "2024-01-01T10:00:00Z"},
        {"role": "agent",    "content": "Click Forgot Password on the login page.", "timestamp": "2024-01-01T10:01:00Z"},
    ],
    customer_email="user@example.com",
)
print(f"Scored: {result['conversation_id']}")`;

    const curlSnippet = `# AgentGrade — cURL webhook example
curl -X POST "${ingestUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${webhook_secret}" \\
  -d '{
    "conversation_id": "your-conv-id-123",
    "customer_identifier": "user@example.com",
    "platform": "${platform}",
    "messages": [
      {"role": "customer", "content": "I need help with my order", "timestamp": "2024-01-01T10:00:00Z"},
      {"role": "agent",    "content": "I can help you with that! What is your order number?", "timestamp": "2024-01-01T10:01:00Z"}
    ]
  }'`;

    const intercomSetup = platform === "intercom"
      ? {
          title: "Intercom Setup",
          steps: [
            "Go to Intercom Settings > Integrations > Webhooks",
            `Add webhook URL: ${appUrl}/api/webhooks/intercom`,
            "Select topic: conversation.admin.closed",
            `Add custom header: X-AgentGrade-Secret: ${webhook_secret}`,
            "Save and test with a closed conversation",
          ],
        }
      : null;

    return NextResponse.json({
      connection: {
        id: connection.id,
        name: connection.name,
        platform,
        webhook_url: ingestUrl,
        webhook_secret,
      },
      snippets: {
        javascript: jsSnippet,
        python: pythonSnippet,
        curl: curlSnippet,
      },
      intercom_setup: intercomSetup,
      docs_url: `${appUrl}/docs/integrations/${platform}`,
    });
  } catch (error) {
    console.error("SDK snippet error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
