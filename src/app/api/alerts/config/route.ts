import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

const VALID_DIMENSIONS = ["overall", "accuracy", "hallucination", "resolution", "tone", "sentiment"];

/**
 * GET /api/alerts/config
 * Returns the current alert threshold configuration for the workspace.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("ag_alert_configs")
      .select("*")
      .eq("workspace_id", ctx.workspace.id)
      .order("dimension");

    if (error) {
      return NextResponse.json({ error: "Failed to fetch alert configs" }, { status: 500 });
    }

    // Fill in defaults for dimensions that haven't been configured yet
    const configuredDimensions = new Set((data || []).map((c) => c.dimension));
    const defaults = VALID_DIMENSIONS
      .filter((d) => !configuredDimensions.has(d))
      .map((d) => ({
        id: null,
        workspace_id: ctx.workspace.id,
        dimension: d,
        threshold: d === "hallucination" ? 0.6 : 0.5,
        enabled: false, // not yet saved
      }));

    return NextResponse.json({
      configs: [...(data || []), ...defaults],
    });
  } catch (error) {
    console.error("Alert config GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/alerts/config
 * Set or update alert thresholds.
 * Body: { configs: [{ dimension, threshold, enabled }] }
 * Or a single: { dimension, threshold, enabled }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["owner", "admin"].includes(ctx.member.role)) {
      return NextResponse.json({ error: "Only owners and admins can configure alerts" }, { status: 403 });
    }

    const body = await request.json();

    // Support both array and single object
    const updates = Array.isArray(body.configs) ? body.configs : [body];

    for (const update of updates) {
      if (!update.dimension) {
        return NextResponse.json({ error: "dimension is required for each config" }, { status: 400 });
      }
      if (!VALID_DIMENSIONS.includes(update.dimension)) {
        return NextResponse.json(
          { error: `Invalid dimension '${update.dimension}'. Must be one of: ${VALID_DIMENSIONS.join(", ")}` },
          { status: 400 }
        );
      }
      if (update.threshold !== undefined && (update.threshold < 0 || update.threshold > 1)) {
        return NextResponse.json({ error: "threshold must be between 0.0 and 1.0" }, { status: 400 });
      }
    }

    // Upsert all configs
    const upsertRows = updates.map((update: { dimension: string; threshold?: number; enabled?: boolean }) => ({
      workspace_id: ctx.workspace.id,
      dimension: update.dimension,
      threshold: update.threshold ?? 0.5,
      enabled: update.enabled ?? true,
    }));

    const { data, error } = await supabaseAdmin
      .from("ag_alert_configs")
      .upsert(upsertRows, { onConflict: "workspace_id,dimension" })
      .select("*");

    if (error) {
      return NextResponse.json({ error: "Failed to save alert configs" }, { status: 500 });
    }

    return NextResponse.json({ success: true, configs: data || [] });
  } catch (error) {
    console.error("Alert config POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
