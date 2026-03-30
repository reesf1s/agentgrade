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
      { role: "tool", content: "lookup_account({ user: 'user@example.com' }) => found" },
      {
        role: "agent",
        content: "Use the Forgot password link on your login page.",
        metadata: { grounded_by: "lookup_account" }
      }
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
// Add these env vars to your app or Vercel project:
// AGENTGRADE_WEBHOOK_URL=${input.webhookUrl}
// AGENTGRADE_BEARER_SECRET=${input.secret}
//
// What they mean:
// - AGENTGRADE_WEBHOOK_URL: where your app sends transcript updates
// - AGENTGRADE_BEARER_SECRET: the workspace-specific secret for Authorization: Bearer <secret>
//
// Then call AgentGrade from the place where your chatbot already has
// the latest transcript or turn events.

${baseExample}`;
}

function buildEnvExample(input: { webhookUrl: string; secret: string }) {
  return `AGENTGRADE_WEBHOOK_URL=${input.webhookUrl}
AGENTGRADE_BEARER_SECRET=${input.secret}`;
}

function buildInstallSteps(input: { platform: string; webhookUrl: string; secret: string }) {
  const baseSteps = [
    "Add the AgentGrade env vars to your local .env.local and your Vercel project env vars.",
    "Restart your app so the new env vars load.",
    "Hook the send call into your chatbot flow where you already have the transcript or latest turn.",
    "If your agent uses tools, include tool turns or message metadata so AgentGrade can distinguish grounded answers from hallucinations.",
    "Send one test conversation and confirm it appears in AgentGrade.",
  ];

  if (input.platform === "voiceflow") {
    return [
      "Create a Voiceflow custom action that POSTs the current transcript to AgentGrade.",
      "Use the Voiceflow-specific endpoint if you want AgentGrade to normalize Voiceflow payloads for you.",
      ...baseSteps.slice(3),
    ];
  }

  return baseSteps;
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
      .from("ag_agent_connections")
      .select("id, platform, webhook_url, webhook_secret, name")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (error || !connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const webhookUrl =
      connection.platform === "voiceflow"
        ? `${resolveAppUrl(_request)}/api/webhooks/voiceflow`
        : `${resolveAppUrl(_request)}/api/webhooks/ingest`;

    const snippet = buildSnippet({
      webhookUrl,
      secret: connection.webhook_secret,
      platform: connection.platform || "custom",
      connectionName: connection.name,
    });

    return NextResponse.json({
      snippet,
      webhook_url: webhookUrl,
      api_key: connection.webhook_secret,
      env_example: buildEnvExample({
        webhookUrl,
        secret: connection.webhook_secret,
      }),
      install_steps: buildInstallSteps({
        platform: connection.platform || "custom",
        webhookUrl,
        secret: connection.webhook_secret,
      }),
      env_help: {
        AGENTGRADE_WEBHOOK_URL:
          "The AgentGrade endpoint your app should POST transcripts to.",
        AGENTGRADE_BEARER_SECRET:
          "The workspace-specific bearer token sent in Authorization: Bearer <secret>.",
      },
    });
  } catch (err) {
    console.error("sdk-snippet GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
