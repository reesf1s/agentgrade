/**
 * Server-side workspace helpers.
 * All functions use supabaseAdmin (service_role) — call only from API routes / server components.
 */
import { getAuthUser } from "@/lib/auth/get-user";
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
  const user = await getAuthUser();
  if (!user) return null;
  return getWorkspaceForUser(user.userId);
}

/**
 * Get workspace context for a specific Clerk user ID.
 */
export async function getWorkspaceForUser(clerkUserId: string): Promise<WorkspaceContext | null> {
  const { data: member, error } = await supabaseAdmin
    .from("ag_workspace_members")
    .select("*, ag_workspaces(*)")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (error || !member) return null;

  return {
    workspace: member.ag_workspaces as unknown as Workspace,
    member: {
      id: member.id,
      workspace_id: member.workspace_id,
      clerk_user_id: member.clerk_user_id,
      role: member.role,
      created_at: member.created_at,
    },
  };
}
