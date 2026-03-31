import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/team
 * Returns all workspace members with their Clerk user info.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("workspace_members")
      .select("id, clerk_user_id, role, created_at, email")
      .eq("workspace_id", ctx.workspace.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch team members" }, { status: 500 });
    }

    return NextResponse.json({ members: data || [] });
  } catch (err) {
    console.error("team GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/team
 * Invites a new team member by email. Requires a workspace invitations table.
 * Body: { email, role }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only owners and admins can invite
    if (!["owner", "admin"].includes(ctx.member.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { email, role = "member" } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    if (!["admin", "member"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("workspace_invitations")
      .insert({
        workspace_id: ctx.workspace.id,
        email,
        role,
        invited_by: ctx.member.clerk_user_id,
        token: crypto.randomUUID(),
      })
      .select()
      .single();

    if (error) {
      console.error("team POST invitation error:", error);
      return NextResponse.json(
        { error: "Workspace invitations are not configured in this environment yet" },
        { status: 501 }
      );
    }

    return NextResponse.json({ success: true, invitation: data }, { status: 201 });
  } catch (err) {
    console.error("team POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/team
 * Removes a team member from the workspace.
 * Body: { member_id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!["owner", "admin"].includes(ctx.member.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { member_id } = body;

    if (!member_id) {
      return NextResponse.json({ error: "member_id required" }, { status: 400 });
    }

    // Cannot remove yourself or the owner
    const { data: targetMember } = await supabaseAdmin
      .from("workspace_members")
      .select("role, clerk_user_id")
      .eq("id", member_id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMember.role === "owner") {
      return NextResponse.json({ error: "Cannot remove the workspace owner" }, { status: 400 });
    }

    if (targetMember.clerk_user_id === ctx.member.clerk_user_id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("id", member_id)
      .eq("workspace_id", ctx.workspace.id);

    if (error) {
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("team DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
