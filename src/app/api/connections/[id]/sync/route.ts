import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUrl } from "@/lib/url";

/**
 * POST /api/connections/:id/sync
 * Triggers a manual sync for a connection.
 * For Intercom: fetches recent closed conversations via Intercom REST API.
 * For other platforms: updates last_sync_at timestamp.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: connection, error: fetchError } = await supabaseAdmin
      .from("ag_agent_connections")
      .select("id, platform, is_active, api_key_encrypted, config, last_sync_at")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    if (!connection.is_active) {
      return NextResponse.json({ error: "Connection is inactive" }, { status: 400 });
    }

    let syncResult: { conversations_synced: number; message: string };

    if (connection.platform === "intercom") {
      syncResult = await syncIntercomConversations(
        id,
        ctx.workspace.id,
        connection.api_key_encrypted,
        connection.last_sync_at,
        resolveAppUrl(request)
      );
    } else {
      // For non-Intercom platforms, just update the sync timestamp
      syncResult = { conversations_synced: 0, message: `Manual sync triggered for ${connection.platform} connection. Push new conversations via webhook.` };
    }

    // Update last_sync_at
    await supabaseAdmin
      .from("ag_agent_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ success: true, ...syncResult });
  } catch (error) {
    console.error("Connection sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Intercom sync ────────────────────────────────────────────────────────────

async function syncIntercomConversations(
  connectionId: string,
  workspaceId: string,
  apiKey: string | null,
  lastSyncAt: string | null,
  appUrl: string
): Promise<{ conversations_synced: number; message: string }> {
  if (!apiKey) {
    return { conversations_synced: 0, message: "No Intercom API key configured. Add one in connection settings." };
  }

  // Fetch closed conversations from Intercom API
  const since = lastSyncAt ? Math.floor(new Date(lastSyncAt).getTime() / 1000) : 0;
  const url = `https://api.intercom.io/conversations?state=closed&updated_since=${since}&per_page=25`;

  let intercomData: { conversations?: { id: string }[] };
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Intercom-Version": "2.10",
      },
    });

    if (!response.ok) {
      throw new Error(`Intercom API error: ${response.status}`);
    }

    intercomData = await response.json();
  } catch (err) {
    console.error("Intercom API fetch error:", err);
    return { conversations_synced: 0, message: `Intercom API error: ${String(err)}` };
  }

  const conversations = intercomData.conversations || [];
  let synced = 0;

  for (const conv of conversations) {
    // Check if already ingested
    const { data: existing } = await supabaseAdmin
      .from("ag_conversations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("external_id", String(conv.id))
      .single();

    if (existing) continue;

    // Fetch full conversation details
    try {
      const detailResponse = await fetch(`https://api.intercom.io/conversations/${conv.id}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "Intercom-Version": "2.10",
        },
      });

      if (!detailResponse.ok) continue;

      const detail = await detailResponse.json();

      // Use the Intercom webhook handler logic via internal fetch
      // Get the connection's webhook_secret for internal call
      const { data: connData } = await supabaseAdmin
        .from("ag_agent_connections")
        .select("webhook_secret")
        .eq("id", connectionId)
        .single();

      if (connData?.webhook_secret) {
        await fetch(`${appUrl}/api/webhooks/intercom`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-AgentGrade-Secret": connData.webhook_secret,
          },
          body: JSON.stringify({
            topic: "conversation.admin.closed",
            data: { item: detail },
          }),
        });
        synced++;
      }
    } catch (err) {
      console.error(`Failed to sync Intercom conversation ${conv.id}:`, err);
    }
  }

  return {
    conversations_synced: synced,
    message: `Synced ${synced} new conversations from Intercom.`,
  };
}
