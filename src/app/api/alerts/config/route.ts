import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/alerts/config
 * Returns the alert threshold configuration for the workspace.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("alert_configs")
      .select("*")
      .eq("workspace_id", ctx.workspace.id);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch alert configs" }, { status: 500 });
    }

    return NextResponse.json({ configs: data || [] });
  } catch (err) {
    console.error("alerts/config GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/alerts/config
 * Saves alert threshold configuration for the workspace.
 * Body: { thresholds: [{ dimension, threshold, enabled }], notification_email? }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { thresholds, notification_email } = body;

    if (!Array.isArray(thresholds)) {
      return NextResponse.json({ error: "thresholds must be an array" }, { status: 400 });
    }

    // Upsert each threshold — alert_configs table has (workspace_id, dimension) unique
    for (const t of thresholds) {
      if (!t.dimension || t.threshold === undefined) continue;
      await supabaseAdmin
        .from("alert_configs")
        .upsert(
          {
            workspace_id: ctx.workspace.id,
            dimension: t.dimension,
            threshold: typeof t.threshold === "number" && t.threshold > 1
              ? t.threshold / 100  // Convert % value to decimal
              : t.threshold,
            enabled: t.enabled !== false,
          },
          { onConflict: "workspace_id,dimension" }
        );
    }

    // Optionally save notification email to workspace record
    if (notification_email) {
      await supabaseAdmin
        .from("workspaces")
        .update({ notification_email })
        .eq("id", ctx.workspace.id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("alerts/config POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
