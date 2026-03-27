/**
 * Workspace context helper — re-exported from lib/workspace for convenience.
 * Import from here in API routes to keep auth concerns co-located.
 */
export {
  getWorkspaceContext,
  getWorkspaceForUser,
  type WorkspaceContext,
} from "@/lib/workspace";
