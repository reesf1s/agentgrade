/**
 * Server-side workspace helpers.
 * All functions use supabaseAdmin (service_role) — call only from API routes / server components.
 */
import { getUserId } from "@/lib/auth/get-user";
import { supabaseAdmin } from "@/lib/supabase";
import type { Workspace, WorkspaceMember } from "@/lib/db/types";

export interface WorkspaceContext {
  workspace: Workspace;
  member: WorkspaceMember;
}

/**
 * Get workspace context for the currently authenticated Clerk user.
 * Returns null if the user is not authenticated or has no workspace.
 */
export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const userId = await getUserId();
  if (!userId) return null;
  return getWorkspaceForUser(userId);
}

/**
 * Get workspace context for a specific Clerk user ID.
 * Auto-creates a workspace if the user has none (handles first-time users
 * where the Clerk webhook may not have fired yet).
 */
export async function getWorkspaceForUser(clerkUserId: string): Promise<WorkspaceContext | null> {
  const { data: member, error } = await supabaseAdmin
    .from("ag_workspace_members")
    .select("*, workspaces:ag_workspaces(*)")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    console.error("[workspace] Failed to fetch workspace membership:", error);
    return null;
  }

  if (!member) {
    // No workspace found — auto-create one for this user
    return autoCreateWorkspace(clerkUserId);
  }

  return {
    workspace: member.workspaces as unknown as Workspace,
    member: {
      id: member.id,
      workspace_id: member.workspace_id,
      clerk_user_id: member.clerk_user_id,
      role: member.role,
      created_at: member.created_at,
    },
  };
}

/**
 * Auto-create a workspace for a user who signed up but whose Clerk webhook
 * either hasn't fired yet or failed silently.
 */
async function autoCreateWorkspace(clerkUserId: string): Promise<WorkspaceContext | null> {
  try {
    const slug = "workspace-" + Math.random().toString(36).substring(2, 8);

    const { data: workspace, error: wsError } = await supabaseAdmin
      .from("ag_workspaces")
      .insert({
        name: "My Workspace",
        slug,
        plan: "starter",
        monthly_conversation_limit: 5000,
      })
      .select()
      .single();

    if (wsError || !workspace) {
      console.error("[workspace] Failed to auto-create workspace:", wsError);
      return null;
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from("ag_workspace_members")
      .insert({
        workspace_id: workspace.id,
        clerk_user_id: clerkUserId,
        role: "owner",
      })
      .select()
      .single();

    if (memberError || !member) {
      console.error("[workspace] Failed to auto-create workspace member:", memberError);

      const { data: existingMember } = await supabaseAdmin
        .from("ag_workspace_members")
        .select("*, workspaces:ag_workspaces(*)")
        .eq("clerk_user_id", clerkUserId)
        .maybeSingle();

      if (existingMember?.workspaces) {
        await supabaseAdmin.from("ag_workspaces").delete().eq("id", workspace.id);
        return {
          workspace: existingMember.workspaces as unknown as Workspace,
          member: {
            id: existingMember.id,
            workspace_id: existingMember.workspace_id,
            clerk_user_id: existingMember.clerk_user_id,
            role: existingMember.role,
            created_at: existingMember.created_at,
          },
        };
      }

      await supabaseAdmin.from("ag_workspaces").delete().eq("id", workspace.id);
      return null;
    }

    console.log(`[workspace] Auto-created workspace ${workspace.id} for user ${clerkUserId}`);

    return {
      workspace: workspace as unknown as Workspace,
      member: {
        id: member.id,
        workspace_id: member.workspace_id,
        clerk_user_id: member.clerk_user_id,
        role: member.role,
        created_at: member.created_at,
      },
    };
  } catch (err) {
    console.error("[workspace] Auto-create error:", err);
    return null;
  }
}
