import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/workspaces/:id/members
 * Returns all members of the workspace.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (ctx.workspace.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("ag_workspace_members")
      .select("id, clerk_user_id, email, role, created_at")
      .eq("workspace_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
    }

    return NextResponse.json({ members: data || [] });
  } catch (error) {
    console.error("Members GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/workspaces/:id/members
 * Invite a member by email address and Clerk user ID.
 * Owners and admins can invite. Only owners can set 'admin' role.
 *
 * Body: { clerk_user_id: string, email: string, role?: 'admin'|'member' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (ctx.workspace.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!["owner", "admin"].includes(ctx.member.role)) {
      return NextResponse.json({ error: "Only owners and admins can invite members" }, { status: 403 });
    }

    const body = await request.json();
    const { clerk_user_id, email, role = "member" } = body;

    if (!clerk_user_id) {
      return NextResponse.json({ error: "clerk_user_id is required" }, { status: 400 });
    }

    const validRoles = ["admin", "member"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `role must be one of: ${validRoles.join(", ")}` }, { status: 400 });
    }

    // Only owners can grant admin role
    if (role === "admin" && ctx.member.role !== "owner") {
      return NextResponse.json({ error: "Only owners can grant admin role" }, { status: 403 });
    }

    // Check if user is already a member
    const { data: existing } = await supabaseAdmin
      .from("ag_workspace_members")
      .select("id, role")
      .eq("workspace_id", id)
      .eq("clerk_user_id", clerk_user_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "User is already a member of this workspace", member: existing },
        { status: 409 }
      );
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from("ag_workspace_members")
      .insert({
        workspace_id: id,
        clerk_user_id,
        email: email || null,
        role,
      })
      .select("id, clerk_user_id, email, role, created_at")
      .single();

    if (memberError || !member) {
      console.error("Failed to add member:", memberError);
      return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
    }

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error("Members POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
