import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/onboarding
 * Saves onboarding configuration: agent connection + alert thresholds.
 *
 * Body:
 * {
 *   platform: 'intercom'|'zendesk'|'custom'|'csv',
 *   name?: string,
 *   api_key?: string,
 *   config?: object,
 *   alert_thresholds?: [{ dimension: string, value: number (0–100) }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { platform, name, api_key, config, alert_thresholds } = body;

    const workspaceId = ctx.workspace.id;

    // Create agent connection if platform was provided
    if (platform) {
      const validPlatforms = ["intercom", "zendesk", "custom", "csv"];
      if (!validPlatforms.includes(platform)) {
        return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
      }

      const webhookSecret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentgrade.com";
      const webhookUrl = `${appUrl}/api/webhooks/ingest`;

      const { data: connection, error: connError } = await supabaseAdmin
        .from("ag_agent_connections")
        .insert({
          workspace_id: workspaceId,
          platform,
          name: name || `${platform.charAt(0).toUpperCase() + platform.slice(1)} Connection`,
          api_key_encrypted: api_key || null,
          webhook_url: webhookUrl,
          webhook_secret: webhookSecret,
          is_active: true,
          config: config || {},
        })
        .select("id, webhook_secret, webhook_url")
        .single();

      if (connError || !connection) {
        console.error("Failed to create agent connection:", connError);
        return NextResponse.json({ error: "Failed to save agent connection" }, { status: 500 });
      }

      // Upsert alert thresholds
      if (alert_thresholds && Array.isArray(alert_thresholds)) {
        for (const threshold of alert_thresholds) {
          if (!threshold.dimension || threshold.value === undefined) continue;
          await supabaseAdmin
            .from("ag_alert_configs")
            .upsert(
              {
                workspace_id: workspaceId,
                dimension: threshold.dimension,
                threshold: threshold.value / 100, // convert % → decimal
                enabled: true,
              },
              { onConflict: "workspace_id,dimension" }
            );
        }
      }

      return NextResponse.json({
        success: true,
        connection_id: connection.id,
        webhook_url: connection.webhook_url,
        webhook_secret: connection.webhook_secret,
      });
    }

    // No platform — just save alert thresholds
    if (alert_thresholds && Array.isArray(alert_thresholds)) {
      for (const threshold of alert_thresholds) {
        if (!threshold.dimension || threshold.value === undefined) continue;
        await supabaseAdmin
          .from("ag_alert_configs")
          .upsert(
            {
              workspace_id: workspaceId,
              dimension: threshold.dimension,
              threshold: threshold.value / 100,
              enabled: true,
            },
            { onConflict: "workspace_id,dimension" }
          );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
