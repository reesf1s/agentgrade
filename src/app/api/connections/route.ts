import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/connections
 * Returns all agent connections for the workspace.
 * Note: webhook_secret is redacted — fetch via GET /api/connections/:id if needed.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("ag_agent_connections")
      .select("id, platform, name, is_active, last_sync_at, webhook_url, created_at")
      .eq("workspace_id", ctx.workspace.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 });
    }

    return NextResponse.json({ connections: data || [] });
  } catch (error) {
    console.error("Connections GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/connections
 * Creates a new agent connection and generates its webhook_secret.
 *
 * Body: { platform, name?, api_key?, config? }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { platform, name, api_key, config } = body;

    const validPlatforms = ["intercom", "zendesk", "custom", "csv"];
    if (!platform || !validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Must be one of: ${validPlatforms.join(", ")}` },
        { status: 400 }
      );
    }

    // Generate a random 32-char hex secret
    const webhookSecret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentgrade.com";
    const webhookUrl = `${appUrl}/api/webhooks/ingest`;

    const { data, error } = await supabaseAdmin
      .from("ag_agent_connections")
      .insert({
        workspace_id: ctx.workspace.id,
        platform,
        name: name || `${platform.charAt(0).toUpperCase() + platform.slice(1)} Connection`,
        api_key_encrypted: api_key || null,
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        is_active: true,
        config: config || {},
      })
      .select("id, platform, name, is_active, webhook_url, webhook_secret, created_at")
      .single();

    if (error || !data) {
      console.error("Failed to create connection:", error);
      return NextResponse.json({ error: "Failed to create connection" }, { status: 500 });
    }

    return NextResponse.json({ connection: data }, { status: 201 });
  } catch (error) {
    console.error("Connections POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
