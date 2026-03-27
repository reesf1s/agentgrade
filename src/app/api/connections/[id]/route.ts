import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/connections/:id
 * Returns full connection details including webhook_secret (for setup flow).
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

    const { data, error } = await supabaseAdmin
      .from("agent_connections")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    // Redact the encrypted API key — never expose it
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { api_key_encrypted: _redacted, ...connection } = data;

    return NextResponse.json({ connection });
  } catch (error) {
    console.error("Connection GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/connections/:id
 * Update connection name, active state, or config.
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
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.config !== undefined) updates.config = body.config;
    if (body.api_key !== undefined) updates.api_key_encrypted = body.api_key;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("agent_connections")
      .update(updates)
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .select("id, platform, name, is_active, webhook_url, last_sync_at, created_at")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Connection not found or update failed" }, { status: 404 });
    }

    return NextResponse.json({ connection: data });
  } catch (error) {
    console.error("Connection PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/connections/:id
 * Removes the agent connection. Cascades to any orphaned conversations (sets FK null).
 * Requires owner or admin role.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["owner", "admin"].includes(ctx.member.role)) {
      return NextResponse.json({ error: "Only owners and admins can delete connections" }, { status: 403 });
    }

    const { id } = await params;

    // Verify connection belongs to workspace before deleting
    const { data: connection, error: fetchError } = await supabaseAdmin
      .from("agent_connections")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("agent_connections")
      .delete()
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id);

    if (deleteError) {
      return NextResponse.json({ error: "Failed to delete connection" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Connection DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
