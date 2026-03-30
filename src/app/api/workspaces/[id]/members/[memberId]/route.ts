import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * DELETE /api/workspaces/:id/members/:memberId
 * Remove a member from the workspace.
 * - Owners can remove anyone except themselves (use account deletion for that)
 * - Admins can remove regular members
 * - Members can remove themselves (leave workspace)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId, memberId } = await params;

    if (ctx.workspace.id !== workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch the target member
    const { data: targetMember, error: fetchError } = await supabaseAdmin
      .from("ag_workspace_members")
      .select("id, clerk_user_id, role")
      .eq("id", memberId)
      .eq("workspace_id", workspaceId)
      .single();

    if (fetchError || !targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Owners cannot be removed (must transfer ownership first)
    if (targetMember.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove the workspace owner. Transfer ownership first." },
        { status: 400 }
      );
    }

    // Self-removal: always allowed (a member leaving)
    const isSelf = targetMember.clerk_user_id === ctx.member.clerk_user_id;

    if (!isSelf) {
      // Permission check: only owner/admin can remove others
      if (!["owner", "admin"].includes(ctx.member.role)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
      // Admins cannot remove other admins
      if (ctx.member.role === "admin" && targetMember.role === "admin") {
        return NextResponse.json({ error: "Admins cannot remove other admins" }, { status: 403 });
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("ag_workspace_members")
      .delete()
      .eq("id", memberId)
      .eq("workspace_id", workspaceId);

    if (deleteError) {
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Member DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
