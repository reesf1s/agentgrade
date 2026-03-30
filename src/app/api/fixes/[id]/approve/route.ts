import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

function isMissingTableError(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST205";
}

/**
 * POST /api/fixes/:id/approve
 * Approves a suggested fix, marking it ready to push.
 * Only owners and admins can approve fixes.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["owner", "admin"].includes(ctx.member.role)) {
      return NextResponse.json({ error: "Only owners and admins can approve fixes" }, { status: 403 });
    }

    const { id } = await params;

    // Verify fix belongs to workspace
    const { data: fix, error: fetchError } = await supabaseAdmin
      .from("ag_suggested_fixes")
      .select("id, status")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (fetchError || !fix) {
      if (isMissingTableError(fetchError)) {
        return NextResponse.json(
          { error: "Suggested fixes storage is not configured yet in this environment" },
          { status: 501 }
        );
      }
      return NextResponse.json({ error: "Fix not found" }, { status: 404 });
    }

    if (fix.status === "pushed" || fix.status === "verified") {
      return NextResponse.json({ error: "Fix has already been pushed" }, { status: 409 });
    }
    if (fix.status === "dismissed") {
      return NextResponse.json({ error: "Fix has been dismissed. Un-dismiss it first." }, { status: 409 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("ag_suggested_fixes")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: ctx.member.clerk_user_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updated) {
      if (isMissingTableError(updateError)) {
        return NextResponse.json(
          { error: "Suggested fixes storage is not configured yet in this environment" },
          { status: 501 }
        );
      }
      return NextResponse.json({ error: "Failed to approve fix" }, { status: 500 });
    }

    return NextResponse.json({ success: true, fix: updated });
  } catch (error) {
    console.error("Fix approve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
