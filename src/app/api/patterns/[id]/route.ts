import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const { error } = await supabaseAdmin
      .from("failure_patterns")
      .update({
        is_resolved: body.is_resolved,
        resolved_at: body.is_resolved ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id);

    if (error) {
      return NextResponse.json({ error: "Failed to update pattern" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pattern PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
