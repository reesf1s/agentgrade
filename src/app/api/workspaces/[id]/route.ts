import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/workspaces/:id
 * Returns workspace details including member list and usage stats.
 * Only accessible by members of the workspace.
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

    // Ensure the user is a member of the requested workspace
    if (ctx.workspace.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch workspace + members in parallel
    const [workspaceRes, membersRes, usageRes] = await Promise.all([
      supabaseAdmin
        .from("ag_workspaces")
        .select("*")
        .eq("id", id)
        .single(),

      supabaseAdmin
        .from("ag_workspace_members")
        .select("id, clerk_user_id, email, role, created_at")
        .eq("workspace_id", id)
        .order("created_at", { ascending: true }),

      // Count conversations this calendar month
      supabaseAdmin
        .from("ag_conversations")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", id)
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);

    if (workspaceRes.error || !workspaceRes.data) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({
      workspace: workspaceRes.data,
      members: membersRes.data || [],
      usage: {
        conversations_this_month: usageRes.count || 0,
        limit: workspaceRes.data.monthly_conversation_limit,
      },
    });
  } catch (error) {
    console.error("Workspace GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/workspaces/:id
 * Update workspace name. Only owners/admins can update.
 */
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

    if (ctx.workspace.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!["owner", "admin"].includes(ctx.member.role)) {
      return NextResponse.json({ error: "Only owners and admins can update the workspace" }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.name) updates.name = body.name.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("ag_workspaces")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update workspace" }, { status: 500 });
    }

    return NextResponse.json({ workspace: data });
  } catch (error) {
    console.error("Workspace PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
