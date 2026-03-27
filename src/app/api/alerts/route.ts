import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/alerts - fetch active alerts
 * PATCH /api/alerts/:id - acknowledge an alert
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("alerts")
      .select("*")
      .eq("workspace_id", ctx.workspace.id)
      .is("acknowledged_at", null)
      .order("triggered_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
    }

    return NextResponse.json({ alerts: data || [] });
  } catch (error) {
    console.error("Alerts GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "alert id required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("alerts")
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: ctx.member.clerk_user_id,
      })
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id);

    if (error) {
      return NextResponse.json({ error: "Failed to acknowledge alert" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Alerts PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
