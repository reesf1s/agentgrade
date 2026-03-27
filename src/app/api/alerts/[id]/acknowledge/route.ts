import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * PUT /api/alerts/:id/acknowledge
 * Acknowledges an alert, marking it as reviewed.
 */
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify alert belongs to this workspace
    const { data: alert, error: fetchError } = await supabaseAdmin
      .from("ag_alerts")
      .select("id, acknowledged_at")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (fetchError || !alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    if (alert.acknowledged_at) {
      return NextResponse.json({ error: "Alert already acknowledged", acknowledged_at: alert.acknowledged_at }, { status: 409 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("ag_alerts")
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: ctx.member.clerk_user_id,
      })
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: "Failed to acknowledge alert" }, { status: 500 });
    }

    return NextResponse.json({ success: true, alert: updated });
  } catch (error) {
    console.error("Alert acknowledge error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
