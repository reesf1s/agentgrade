import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/alerts
 * Returns unacknowledged alerts for the workspace, most recent first.
 * Query params: include_acknowledged=true to include all alerts.
 */
export async function GET(request: Request) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeAcknowledged = searchParams.get("include_acknowledged") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("ag_alerts")
      .select("*", { count: "exact" })
      .eq("workspace_id", ctx.workspace.id)
      .order("triggered_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!includeAcknowledged) {
      query = query.is("acknowledged_at", null);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
    }

    return NextResponse.json({ alerts: data || [], total: count || 0, page, limit });
  } catch (error) {
    console.error("Alerts GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
